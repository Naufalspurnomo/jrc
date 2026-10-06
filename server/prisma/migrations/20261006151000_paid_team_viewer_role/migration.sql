-- Dedicated read-only role for divisions that only need the paid-team list.
ALTER TYPE "Role" ADD VALUE 'PAID_TEAM_VIEWER';