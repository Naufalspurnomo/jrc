import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.useRealTimers());

import { ConfirmationDialog } from './ConfirmationDialog';
import { ToastProvider, useToast } from './ToastProvider';

function ToastHarness() {
  const { showToast } = useToast();
  const count = useRef(0);
  return <>
    <button onClick={() => showToast(`Tersimpan ${++count.current}`, 'success')}>Sukses</button>
    <button onClick={() => showToast(`Gagal ${++count.current}`, 'error')}>Gagal</button>
  </>;
}

function DialogHarness({ onConfirm = vi.fn() }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  return <>
    <button onClick={() => setOpen(true)}>pemicu</button>
    <ConfirmationDialog
      open={open}
      title="Hapus?"
      description="Tidak dapat dibatalkan."
      confirmationLabel="JRC-001"
      confirmationValue={value}
      onConfirmationChange={setValue}
      onCancel={() => setOpen(false)}
      onConfirm={onConfirm}
    />
  </>;
}

describe('ToastProvider', () => {
  it('uses one live announcer, caps visible notifications, and dismisses with Escape', async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ToastHarness /></ToastProvider>);
    for (let index = 0; index < 6; index += 1) await user.click(screen.getByRole('button', { name: index % 2 ? 'Gagal' : 'Sukses' }));
    expect(screen.getAllByRole('group', { name: /Notifikasi:/ })).toHaveLength(4);
    expect(screen.getAllByLabelText('Pengumuman notifikasi')).toHaveLength(1);
    const close = screen.getAllByRole('button', { name: 'Tutup notifikasi' })[0];
    close.focus();
    await user.keyboard('{Escape}');
    expect(screen.getAllByRole('group', { name: /Notifikasi:/ })).toHaveLength(3);
  });

  it('pauses expiry while hovered and resumes with remaining time', async () => {
    vi.useFakeTimers();
    const { getByRole } = render(<ToastProvider><ToastHarness /></ToastProvider>);
    await act(async () => { getByRole('button', { name: 'Sukses' }).click(); });
    const toast = getByRole('group', { name: /Tersimpan/ });
    act(() => { vi.advanceTimersByTime(3000); fireEvent.mouseEnter(toast); });
    act(() => vi.advanceTimersByTime(5000));
    expect(toast).toBeInTheDocument();
    act(() => { fireEvent.mouseLeave(toast); vi.advanceTimersByTime(1999); });
    expect(toast).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2));
    expect(toast).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('ConfirmationDialog', () => {
  it('focuses input, traps Tab, requires exact case-sensitive text, submits with Enter, and restores focus', async () => {
    const user = userEvent.setup();
    const confirm = vi.fn();
    render(<DialogHarness onConfirm={confirm} />);
    await user.click(screen.getByRole('button', { name: 'pemicu' }));
    const input = screen.getByRole('textbox', { name: /Ketik JRC-001/ });
    expect(input).toHaveFocus();
    await user.type(input, 'jrc-001{Enter}');
    expect(confirm).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, 'JRC-001{Enter}');
    expect(confirm).toHaveBeenCalledOnce();
    const submit = screen.getByRole('button', { name: 'Hapus permanen' });
    submit.focus();
    await user.tab();
    expect(input).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'pemicu' })).toHaveFocus();
  });

  it('locks and restores body scrolling while open', async () => {
    const user = userEvent.setup();
    document.body.style.overflow = 'scroll';
    const view = render(<DialogHarness />);
    await user.click(screen.getByRole('button', { name: 'pemicu' }));
    expect(document.body.style.overflow).toBe('hidden');
    view.unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });
});
