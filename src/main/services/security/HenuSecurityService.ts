import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../db';
import { HenuMasterService } from '../master/HenuMasterService';

export interface SecurityEvent {
  timestamp: string;
  action: 'SOCIETY_DELETE' | 'BACKUP_START' | 'RESTORE_START' | 'OCR_UNLOCK' | 'OCR_LOCK' | 'ADMIN_AUTH';
  societyId?: string;
  societyName?: string;
  passwordResult: 'SUCCESS' | 'FAILURE' | 'SKIPPED';
  mfaResult?: 'SUCCESS' | 'FAILURE' | 'SKIPPED';
  result: 'SUCCESS' | 'FAILURE';
  errorCategory?: string;
}

export interface MfaChallengeRecord {
  challengeId: string;
  societyId: string;
  code: string;
  expiresAt: number;
  verified: boolean;
  mfaToken?: string;
}

export interface VerifyPasswordResult {
  success: boolean;
  error?: string;
  locked?: boolean;
  remainingAttempts?: number;
  lockSeconds?: number;
}

export class HenuSecurityService {
  private static instance: HenuSecurityService;

  // SHA-256 Hashes of the 10 Authorized Administrative Passwords (HENUMASTER + Backup/Restore)
  private readonly adminPasswordHashes: string[] = [
    'e1032a0e5a28060d37f7bc80b37aadaaf0bd0a05ab4530f9b67ad64bd00e3a98', // Admin 1
    '82931df46247e3dd54b4aebdfc0a77ed4f137c16262ea36ef8b938c269e7ee6e', // Admin 2
    'c18bfa0ce8848c7083cf5f2e2000f2abdef1eb53cf72fa1f2019739f9bbac973', // Admin 3
    '41a9d5daf1d4410941775974a6af877fe312b402cf2f44c27cc2f37e1bb7b2b5', // Admin 4
    '53c011ebe1d442318d6fd08cc9252717d115d80735cb0355de5e1741c13142f6', // Admin 5
    '46598d5afb13d468f594123e80c8f5227bf322bab33b56035d6bc17464b924a0', // Admin 6
    '0b239ed193d8c9ed3f4cc9cc3204cc8f011ce7edb1831f37fce20b0459c270f4', // Admin 7
    'c3927d543f990bc1d22f4e9223d0d889596373918744491cba2e8e841880c1d1', // Admin 8
    '0a835e80e723ffbb6d62cdd6ffc4daf96050145f735958d31e0524ed8a62952d', // Admin 9
    '52753da1407e31d84f6bc5f6acce88ee81180f08f14e8fb5a94538b6949b387c', // Admin 10
  ];

  // SHA-256 Hashes of the 10 Authorized OCR Passwords (HENU Voucher OCR + CHECK OCR)
  private readonly ocrPasswordHashes: string[] = [
    'f286365912d193644158e94f88ef93b20e833fe25343b0be84d59415d367d403', // OCR 1
    '0140f4f6c63039e26a0ec65526d6bf8fce1de039e2c7bc00a6b05104c1f44495', // OCR 2
    'c18bfa0ce8848c7083cf5f2e2000f2abdef1eb53cf72fa1f2019739f9bbac973', // OCR 3
    '4982555d0769a600910c669221a036de3944e93923827b6a2cdc44350ceb60e6', // OCR 4
    'a61e6916924b7d93e821a0e4400512d7f99edf9002daaffc7cb01e0a30ebcfe6', // OCR 5
    'b974e7e54c540dc4aebadc236924073d005dbf67b9d7325030ad9e1ff3c18315', // OCR 6
    '4e870bed74508e9cbd4b6784868a5bbe02b7c33d3d2b5e270014e6802c85acdf', // OCR 7
    '357b5d3d8d353d241f518e72223d013c0c09880619495b611c959ef87c37f070', // OCR 8
    'a94b2fdd5ce4cf9d6dac4438398e805de0267ce544e1d401d3397161ee83363f', // OCR 9
    '3cdc1e474b3b78bb4242fb03d2a945ac88d2069e7891e63c1e2fa574a044f584', // OCR 10
  ];

  // Brute-force Tracking
  private adminFailedAttempts = 0;
  private adminLockUntil = 0;
  private ocrFailedAttempts: Record<string, number> = {};
  private ocrLockUntil: Record<string, number> = {};

  // Session State (InMemory, reset on lock/restart)
  private ocrUnlockedModules: Set<string> = new Set();

  // Active MFA Challenges (TTL: 5 mins, Single-Use)
  private mfaChallenges: Map<string, MfaChallengeRecord> = new Map();

  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 30000; // 30 seconds

  private constructor() {
    this.initAuditLogTable();
  }

  public static getInstance(): HenuSecurityService {
    if (!HenuSecurityService.instance) {
      HenuSecurityService.instance = new HenuSecurityService();
    }
    return HenuSecurityService.instance;
  }

  private initAuditLogTable(): void {
    try {
      const db = getDatabase();
      db.prepare(`
        CREATE TABLE IF NOT EXISTS security_audit_logs (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          action TEXT NOT NULL,
          society_id TEXT,
          society_name TEXT,
          password_result TEXT NOT NULL,
          mfa_result TEXT,
          result TEXT NOT NULL,
          error_category TEXT,
          metadata TEXT
        )
      `).run();
    } catch {
      // JSON Adapter fallback handles seamlessly
    }
  }

  /** Constant-time hash verification against a list of authorized SHA-256 hashes */
  private verifyHashConstantTime(candidate: string, authorizedHexHashes: string[]): boolean {
    if (!candidate || typeof candidate !== 'string') return false;
    const candidateHash = crypto.createHash('sha256').update(candidate, 'utf8').digest();

    let matched = false;
    for (const hex of authorizedHexHashes) {
      const targetHash = Buffer.from(hex, 'hex');
      if (candidateHash.length === targetHash.length) {
        if (crypto.timingSafeEqual(candidateHash, targetHash)) {
          matched = true;
        }
      }
    }
    return matched;
  }

  // ── Administrative Password Verification ──────────────────────────

  public verifyAdminPassword(password: string): VerifyPasswordResult {
    const now = Date.now();
    if (this.adminLockUntil > now) {
      const lockSeconds = Math.ceil((this.adminLockUntil - now) / 1000);
      return {
        success: false,
        locked: true,
        lockSeconds,
        error: `Authentication temporarily locked due to repeated failed attempts. Please retry in ${lockSeconds}s.`,
      };
    }

    const isValid = this.verifyHashConstantTime(password, this.adminPasswordHashes);

    if (isValid) {
      this.adminFailedAttempts = 0;
      this.adminLockUntil = 0;
      this.logAudit({
        timestamp: new Date().toISOString(),
        action: 'ADMIN_AUTH',
        passwordResult: 'SUCCESS',
        result: 'SUCCESS',
      });
      return { success: true };
    } else {
      this.adminFailedAttempts++;
      if (this.adminFailedAttempts >= this.MAX_FAILED_ATTEMPTS) {
        this.adminLockUntil = now + this.LOCKOUT_DURATION_MS;
      }
      const remaining = Math.max(0, this.MAX_FAILED_ATTEMPTS - this.adminFailedAttempts);
      this.logAudit({
        timestamp: new Date().toISOString(),
        action: 'ADMIN_AUTH',
        passwordResult: 'FAILURE',
        result: 'FAILURE',
        errorCategory: 'INVALID_CREDENTIALS',
      });
      return {
        success: false,
        remainingAttempts: remaining,
        error: 'Invalid password.',
      };
    }
  }

  // ── OCR Module Password & Session Management ──────────────────────

  public verifyOcrPassword(password: string, module: 'voucher-ocr' | 'check-ocr'): VerifyPasswordResult {
    const modKey = module || 'voucher-ocr';
    const now = Date.now();
    const lockUntil = this.ocrLockUntil[modKey] || 0;

    if (lockUntil > now) {
      const lockSeconds = Math.ceil((lockUntil - now) / 1000);
      return {
        success: false,
        locked: true,
        lockSeconds,
        error: `Module temporarily locked due to repeated failed attempts. Please retry in ${lockSeconds}s.`,
      };
    }

    const isValid = this.verifyHashConstantTime(password, this.ocrPasswordHashes);

    if (isValid) {
      this.ocrFailedAttempts[modKey] = 0;
      this.ocrLockUntil[modKey] = 0;
      this.ocrUnlockedModules.add(modKey);
      this.logAudit({
        timestamp: new Date().toISOString(),
        action: 'OCR_UNLOCK',
        passwordResult: 'SUCCESS',
        result: 'SUCCESS',
      });
      return { success: true };
    } else {
      const fails = (this.ocrFailedAttempts[modKey] || 0) + 1;
      this.ocrFailedAttempts[modKey] = fails;
      if (fails >= this.MAX_FAILED_ATTEMPTS) {
        this.ocrLockUntil[modKey] = now + this.LOCKOUT_DURATION_MS;
      }
      const remaining = Math.max(0, this.MAX_FAILED_ATTEMPTS - fails);
      this.logAudit({
        timestamp: new Date().toISOString(),
        action: 'OCR_UNLOCK',
        passwordResult: 'FAILURE',
        result: 'FAILURE',
        errorCategory: 'INVALID_CREDENTIALS',
      });
      return {
        success: false,
        remainingAttempts: remaining,
        error: 'Invalid password.',
      };
    }
  }

  public isOcrUnlocked(module: 'voucher-ocr' | 'check-ocr'): boolean {
    return this.ocrUnlockedModules.has(module);
  }

  public lockOcrModule(module: 'voucher-ocr' | 'check-ocr'): boolean {
    this.ocrUnlockedModules.delete(module);
    this.logAudit({
      timestamp: new Date().toISOString(),
      action: 'OCR_LOCK',
      passwordResult: 'SKIPPED',
      result: 'SUCCESS',
    });
    return true;
  }

  // ── MFA Challenge for Permanent Deletion ──────────────────────────

  /**
   * Generates a 6-digit MFA challenge code for permanent society deletion.
   * TTL: 5 minutes.
   */
  public createMfaChallenge(societyId: string): { success: boolean; challengeId: string; code: string; expiresAt: string } {
    if (!societyId) {
      throw new Error('Society ID is required for MFA challenge creation');
    }

    // Clean up expired challenges
    const now = Date.now();
    for (const [id, rec] of this.mfaChallenges.entries()) {
      if (rec.expiresAt <= now) {
        this.mfaChallenges.delete(id);
      }
    }

    const challengeId = uuidv4();
    // 6-digit random code
    const codeNum = crypto.randomInt(100000, 999999);
    const code = String(codeNum);
    const ttlMs = 5 * 60 * 1000; // 5 minutes
    const expiresAt = now + ttlMs;

    this.mfaChallenges.set(challengeId, {
      challengeId,
      societyId,
      code,
      expiresAt,
      verified: false,
    });

    return {
      success: true,
      challengeId,
      code, // Available for the challenge modal UI prompt
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  /**
   * Verifies the 6-digit MFA code and issues a single-use authorization token.
   */
  public verifyMfaChallenge(challengeId: string, candidateCode: string, societyId: string): { success: boolean; mfaToken?: string; error?: string } {
    const record = this.mfaChallenges.get(challengeId);
    if (!record) {
      return { success: false, error: 'MFA challenge not found or expired.' };
    }

    if (Date.now() > record.expiresAt) {
      this.mfaChallenges.delete(challengeId);
      return { success: false, error: 'MFA challenge has expired. Please restart deletion.' };
    }

    if (record.societyId !== societyId) {
      this.mfaChallenges.delete(challengeId);
      return { success: false, error: 'MFA challenge target mismatch.' };
    }

    const cleanCandidate = String(candidateCode || '').trim();
    if (cleanCandidate !== record.code) {
      return { success: false, error: 'Invalid 6-digit verification code.' };
    }

    // Issue single-use token bound to this deletion
    const mfaToken = `mfa_${uuidv4()}_${Date.now()}`;
    record.verified = true;
    record.mfaToken = mfaToken;

    return { success: true, mfaToken };
  }

  // ── Secure Society Deletion Execution ─────────────────────────────

  /**
   * Executes permanent society deletion ONLY after validating the MFA token.
   */
  public executeSecureSocietyDelete(societyId: string, mfaToken: string): { success: boolean; message: string; remainingCount: number } {
    // 1. Verify MFA token
    let validChallenge: MfaChallengeRecord | null = null;
    let foundChallengeId = '';

    for (const [chId, rec] of this.mfaChallenges.entries()) {
      if (rec.verified && rec.mfaToken === mfaToken && rec.societyId === societyId) {
        validChallenge = rec;
        foundChallengeId = chId;
        break;
      }
    }

    if (!validChallenge || Date.now() > validChallenge.expiresAt) {
      this.logAudit({
        timestamp: new Date().toISOString(),
        action: 'SOCIETY_DELETE',
        societyId,
        passwordResult: 'SUCCESS',
        mfaResult: 'FAILURE',
        result: 'FAILURE',
        errorCategory: 'INVALID_OR_EXPIRED_MFA_TOKEN',
      });
      throw new Error('Security Violation: Unauthorized deletion attempt. Valid MFA token required.');
    }

    // Invalidate MFA token immediately (Single-Use Guarantee)
    this.mfaChallenges.delete(foundChallengeId);

    // 2. Delegate to HenuMasterService for safe database cascade and canonical folder removal
    try {
      const result = HenuMasterService.getInstance().deleteSociety(societyId);

      this.logAudit({
        timestamp: new Date().toISOString(),
        action: 'SOCIETY_DELETE',
        societyId,
        passwordResult: 'SUCCESS',
        mfaResult: 'SUCCESS',
        result: 'SUCCESS',
      });

      return result;
    } catch (err: any) {
      this.logAudit({
        timestamp: new Date().toISOString(),
        action: 'SOCIETY_DELETE',
        societyId,
        passwordResult: 'SUCCESS',
        mfaResult: 'SUCCESS',
        result: 'FAILURE',
        errorCategory: err.message || 'EXECUTION_FAILED',
      });
      throw err;
    }
  }

  // ── Audit Logging ─────────────────────────────────────────────────

  public logAudit(event: SecurityEvent): void {
    try {
      const db = getDatabase();
      const id = uuidv4();
      db.prepare(`
        INSERT INTO security_audit_logs
        (id, timestamp, action, society_id, society_name, password_result, mfa_result, result, error_category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        event.timestamp || new Date().toISOString(),
        event.action,
        event.societyId || null,
        event.societyName || null,
        event.passwordResult,
        event.mfaResult || 'SKIPPED',
        event.result,
        event.errorCategory || null
      );
    } catch {
      // Fallback
    }
  }

  public getAuditLogs(limit = 100): any[] {
    try {
      const db = getDatabase();
      return (db.prepare('SELECT * FROM security_audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit) || []) as any[];
    } catch {
      return [];
    }
  }
}
