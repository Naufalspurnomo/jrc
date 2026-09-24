import { chmodSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const deploy = resolve(__dirname, '../scripts/deploy-release.sh');
const rollback = resolve(__dirname, '../scripts/rollback-release.sh');
const SHA = 'a'.repeat(40), OLD = 'b'.repeat(40);
const roots: string[] = [];
type Fixture = ReturnType<typeof fixture>;
const exe=(p:string,b:string)=>{writeFileSync(p,`#!/usr/bin/env bash\nset -eu\n${b}\n`);chmodSync(p,0o755)};
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'jrc-release-')); roots.push(root);
 const repo=join(root,'repo'),front=join(root,'front'),releases=join(root,'releases'),rb=join(root,'rollbacks'),backup=join(root,'backup'),bin=join(root,'bin');
 for(const p of [repo,front,releases,rb,backup,bin,join(releases,'old')]) mkdirSync(p,{recursive:true});
 writeFileSync(join(repo,'compose.yml'),'services: {}\n');writeFileSync(join(repo,'.env'),'SAFE=1\n');
 writeFileSync(join(front,'release.json'),JSON.stringify({sha:SHA}));writeFileSync(join(front,'index.html'),'new');writeFileSync(join(releases,'old','index.html'),'old');
 symlinkSync(join(releases,'old'),join(root,'current'));writeFileSync(join(root,'marker'),'old\n');
 writeFileSync(join(backup,'database.dump'),'db');writeFileSync(join(backup,'private-storage.tar.gz'),'files');
 const sums=spawnSync('sha256sum',['database.dump','private-storage.tar.gz'],{cwd:backup,encoding:'utf8'}).stdout;writeFileSync(join(backup,'SHA256SUMS'),sums);writeFileSync(join(root,'state'),'');
 exe(join(bin,'git'),`[[ "$1" == -C ]] && shift 2; case "$1 $2" in "status --porcelain") [[ ! -e "$JRC_TEST_ROOT/dirty" ]] || echo dirty;; "rev-parse HEAD") echo ${SHA};; *) exit 2;; esac`);
 exe(join(bin,'docker'),`echo "JRC_API_IMAGE=${'$'}{JRC_API_IMAGE:-} JRC_MIGRATION_IMAGE=${'$'}{JRC_MIGRATION_IMAGE:-} $*" >> "$JRC_TEST_ROOT/state"
newapi="registry/api:${SHA}"; newmig="registry/migrate:${SHA}"; oldapi="registry/api:${OLD}"; oldmig="registry/migrate:${OLD}"
if [[ "$1" == image && "$2" == inspect ]]; then img="\${5:-}"; [[ "$img" == *:${SHA} ]] && echo ${SHA} || echo ${OLD}; exit 0; fi
if [[ "$1" == inspect ]]; then fmt="$3"; if [[ "$fmt" == *Health* ]]; then [[ -e "$JRC_TEST_ROOT/no-health" ]] && echo '<no value>' || { [[ -e "$JRC_TEST_ROOT/unhealthy" ]] && echo unhealthy || echo healthy; }; elif [[ "$fmt" == *Config.Image* ]]; then [[ -e "$JRC_TEST_ROOT/wrong-image" ]] && echo registry/api:wrong-${SHA} || { [[ -e "$JRC_TEST_ROOT/rolled" ]] && echo "$oldapi" || echo "$newapi"; }; else [[ -e "$JRC_TEST_ROOT/rolled" ]] && echo ${OLD} || echo ${SHA}; fi; exit 0; fi
if [[ "$1" == compose ]]; then
 case " $* " in
  *" config --format json "*) if [[ -n "${'$'}{JRC_API_IMAGE:-}" ]]; then a="$JRC_API_IMAGE"; m="$JRC_MIGRATION_IMAGE"; else a="$oldapi"; m="$oldmig"; fi; printf '{"services":{"jrc-api":{"image":"%s"},"jrc-migrate":{"image":"%s"}}}\\n' "$a" "$m";;
  *" run --rm jrc-migrate "*) [[ ! -e "$JRC_TEST_ROOT/migrate-fail" ]];;
  *" up -d --no-deps --force-recreate jrc-api "*) [[ ! -e "$JRC_TEST_ROOT/up-fail" ]] || exit 1; [[ "$JRC_API_IMAGE" != "$oldapi" ]] || touch "$JRC_TEST_ROOT/rolled";;
  *" ps -q jrc-api "*) echo cid;; *) exit 2;; esac; exit; fi
exit 2`);
 exe(join(bin,'timeout'),`[[ "$1" == -- ]] && shift; shift; exec "$@"`);
 const env={PATH:`${bin}:${process.env.PATH}`,JRC_TEST_ROOT:root,JRC_REPOSITORY_ROOT:repo,JRC_COMPOSE_FILE:join(repo,'compose.yml'),JRC_COMPOSE_ENV_FILE:join(repo,'.env'),JRC_RELEASE_SHA:SHA,JRC_FRONTEND_SOURCE_DIR:front,JRC_RELEASE_ROOT:releases,JRC_CURRENT_SYMLINK:join(root,'current'),JRC_CURRENT_RELEASE_MARKER:join(root,'marker'),JRC_ROLLBACK_DIR:rb,JRC_BACKUP_DIR:backup,JRC_API_IMAGE:`registry/api:${SHA}`,JRC_MIGRATION_IMAGE:`registry/migrate:${SHA}`,JRC_HEALTH_RETRIES:'2',JRC_HEALTH_INTERVAL_SECONDS:'0',JRC_COMMAND_TIMEOUT_SECONDS:'5'};
 return {root,repo,front,releases,rb,backup,bin,env};
}
const run=(s:string,a:string[],f:Fixture,e:Record<string,string>={})=>spawnSync(s,a,{env:{...process.env,...f.env,...e},encoding:'utf8'});
const rec=(f:Fixture)=>join(f.rb,`rollback-${SHA}.record`);
afterEach(()=>roots.splice(0).forEach(r=>rmSync(r,{recursive:true,force:true})));
describe('release deployment scripts',()=>{
 it('records baseline images and rollback restores them',()=>{const f=fixture();expect(run(deploy,['--apply'],f).status).toBe(0);const text=readFileSync(rec(f),'utf8');expect(text).toContain(`previous_api_image=registry/api:${OLD}`);expect(text).toContain(`previous_migration_image=registry/migrate:${OLD}`);expect(lstatSync(rec(f)).mode&0o777).toBe(0o600);expect(run(rollback,['--apply',rec(f)],f).status).toBe(0);expect(readFileSync(join(f.root,'state'),'utf8')).toContain(`JRC_API_IMAGE` as never);expect(readlinkSync(join(f.root,'current'))).toBe(join(f.releases,'old'));});
 it('rejects substring SHA tags and malformed release JSON',()=>{const f=fixture();expect(run(deploy,['--check'],f,{JRC_API_IMAGE:`registry/api:x${SHA}x`}).status).not.toBe(0);writeFileSync(join(f.front,'release.json'),`{"sha":"${SHA}"} junk`);expect(run(deploy,['--check'],f).status).not.toBe(0);});
 it('rejects escaping or incomplete manifests',()=>{const f=fixture();writeFileSync(join(f.backup,'SHA256SUMS'),`${'0'.repeat(64)}  ../outside\n`);expect(run(deploy,['--check'],f).status).not.toBe(0);writeFileSync(join(f.backup,'SHA256SUMS'),spawnSync('sha256sum',['database.dump'],{cwd:f.backup,encoding:'utf8'}).stdout);expect(run(deploy,['--check'],f).status).not.toBe(0);});
 it('validates health settings before migration',()=>{const f=fixture();const r=run(deploy,['--apply'],f,{JRC_HEALTH_RETRIES:'999999'});expect(r.status).not.toBe(0);expect(readFileSync(join(f.root,'state'),'utf8')).not.toContain(' run ');});
 it('requires healthcheck and exact active image',()=>{for(const flag of ['no-health','wrong-image']){const f=fixture();writeFileSync(join(f.root,flag),'');const r=run(deploy,['--apply'],f);expect(r.status).not.toBe(0);expect(readlinkSync(join(f.root,'current'))).toBe(join(f.releases,'old'));}});
 it('rejects external records, stale state, and symlinked parents',()=>{const f=fixture();expect(run(deploy,['--apply'],f).status).toBe(0);const external=join(f.root,'copy');writeFileSync(external,readFileSync(rec(f)));chmodSync(external,0o600);expect(run(rollback,['--check',external],f).status).not.toBe(0);writeFileSync(join(f.root,'marker'),'stale\n');expect(run(rollback,['--check',rec(f)],f).status).not.toBe(0);const f2=fixture();rmSync(f2.rb,{recursive:true});symlinkSync(f2.front,f2.rb);expect(run(deploy,['--check'],f2).status).not.toBe(0);});
 it('rejects canonical release escape',()=>{const f=fixture();expect(run(deploy,['--check'],f,{JRC_RELEASE_ROOT:`${f.root}/x/../releases`}).status).not.toBe(0);});
 it('preserves pointer and marker on pre-switch and marker switch faults',()=>{const f=fixture();writeFileSync(join(f.root,'migrate-fail'),'');expect(run(deploy,['--apply'],f).status).not.toBe(0);expect(readFileSync(join(f.root,'marker'),'utf8')).toBe('old\n');const f2=fixture();rmSync(join(f2.root,'marker'));mkdirSync(join(f2.root,'marker'));expect(run(deploy,['--apply'],f2).status).not.toBe(0);expect(readlinkSync(join(f2.root,'current'))).toBe(join(f2.releases,'old'));});
 it('rejects invalid timeout before mutation',()=>{const f=fixture();expect(run(deploy,['--apply'],f,{JRC_COMMAND_TIMEOUT_SECONDS:'0'}).status).not.toBe(0);expect(readFileSync(join(f.root,'state'),'utf8')).toBe('');});
});
