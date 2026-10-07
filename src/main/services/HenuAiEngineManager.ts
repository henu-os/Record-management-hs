/**
 * HENU AI ENGINE MANAGER — AUTHORITATIVE USB ENGINE & MODEL CONTRACT
 * Module: Main Services
 * 
 * Authoritative Engine Lifecycle & State Contract:
 * - USB_NOT_DETECTED: Pen drive / engine drive is not accessible
 * - USB_DETECTED: Physical drive found, validating engine structure
 * - ENGINE_VALIDATING: Validating runtime files and model integrity
 * - ENGINE_READY: USB validated, models present, ready for execution
 * - ENGINE_ON: Engine actively running and accepting OCR jobs
 * - ENGINE_OFF: Engine manually switched OFF by user
 * - ENGINE_ERROR: Engine fault or dependency failure
 * - MODEL_MISSING: Required model files missing from USB directory
 * - RUNTIME_ERROR: Runtime process / worker execution failure
 * 
 * USB IDENTITY VALIDATION:
 * - manifest.json must exist and contain valid installation_id
 * - DEVICE_ID.txt must exist and match manifest installation_id
 * - VERSION.txt must exist
 * - Required model directories must exist on USB
 * 
 * STORAGE POLICY:
 * - Zero C:\ model/OCR data storage
 * - All HENU AI runtime data stays on validated USB
 * - Dynamic USB discovery — NEVER hardcode drive letters
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

export type HenuAiEngineState =
  | 'USB_NOT_DETECTED'
  | 'USB_DETECTED'
  | 'ENGINE_VALIDATING'
  | 'SERVICE_STARTING'
  | 'MODEL_LOADING'
  | 'ENGINE_READY'
  | 'ENGINE_ON'
  | 'ENGINE_OFF'
  | 'ENGINE_ERROR'
  | 'MODEL_MISSING'
  | 'RUNTIME_ERROR';

export interface ModelStatusInfo {
  name: string;
  key: string;
  status: 'READY' | 'STANDBY' | 'BLOCKED' | 'MISSING' | 'DISABLED';
  modelPath: string;
  version?: string;
  sizeBytes?: number;
  lastChecked: string;
  isAvailable: boolean;
}

export interface HenuAiEngineStatusReport {
  state: HenuAiEngineState;
  isEngineOn: boolean;
  isUsbConnected: boolean;
  usbDriveLetter: string;
  engineRootPath: string;
  modelsDirectory: string;
  tempDirectory: string;
  runtimeStatus: string;
  statusMessage: string;
  lastHealthCheck: string;
  models: {
    tesseract: ModelStatusInfo;
    glmOcr: ModelStatusInfo;
    fireRedOcr: ModelStatusInfo;
    kraken: ModelStatusInfo;
    llamaVision?: ModelStatusInfo;
    qwen3Coder?: ModelStatusInfo;
  };
  diagnostics: {
    offlineMode: boolean;
    zeroCloudTelemetry: boolean;
    activeJobsCount: number;
    memoryCleanupEnabled: boolean;
    sequentialExecution: boolean;
  };
  usbIdentity?: {
    installationId: string;
    version: string;
    engineName: string;
    manifestValid: boolean;
  };
}

interface HenuAiManifest {
  manifest_format_version: string;
  engine_name: string;
  version: string;
  installation_id: string;
  models?: {
    glm_ocr?: { path: string; status: string };
    firered_ocr?: { path: string; status: string };
    kraken?: { path: string; status: string };
    llama_vision?: { path: string; status: string };
    qwen3_coder?: { path: string; status: string; is_ocr_engine?: boolean };
  };
  directories?: {
    models?: string;
    runtime?: string;
    temp?: string;
    logs?: string;
    state?: string;
  };
}

export class HenuAiEngineManager {
  private static instance: HenuAiEngineManager | null = null;

  private isEngineOn: boolean = true;
  private currentState: HenuAiEngineState = 'USB_NOT_DETECTED';
  private detectedEngineRoot: string = '';
  private detectedDriveLetter: string = '';
  private lastHealthCheckTime: string = new Date().toISOString();
  private checkInterval: NodeJS.Timeout | null = null;
  private activeJobsCount: number = 0;
  private cachedManifest: HenuAiManifest | null = null;
  private cachedDeviceId: string = '';
  private serviceProcess: ChildProcess | null = null;
  private isStartingService: boolean = false;

  private constructor() {
    this.detectAndValidate();
    this.startPresenceWatcher();
  }

  public static getInstance(): HenuAiEngineManager {
    if (!HenuAiEngineManager.instance) {
      HenuAiEngineManager.instance = new HenuAiEngineManager();
    }
    return HenuAiEngineManager.instance;
  }

  /**
   * Dynamically discovers the HENU AI USB pen drive.
   * Scans candidate removable/external drive letters.
   * Validates the USB identity via manifest.json, DEVICE_ID.txt, VERSION.txt.
   */
  public detectUsbEngineRoot(): { rootPath: string; driveLetter: string; isValid: boolean } {
    const candidateDrives = ['D:', 'E:', 'F:', 'G:', 'H:', 'I:', 'J:', 'K:', 'L:', 'U:'];

    for (const drive of candidateDrives) {
      try {
        const driveFormatted = drive.endsWith('\\') ? drive : `${drive}\\`;
        const henuAiRoot = path.join(driveFormatted, 'HENU AI');
        if (!fs.existsSync(henuAiRoot)) continue;

        const manifestPath = path.join(henuAiRoot, 'manifest.json');
        const deviceIdPath = path.join(henuAiRoot, 'DEVICE_ID.txt');
        const versionPath = path.join(henuAiRoot, 'VERSION.txt');

        if (!fs.existsSync(manifestPath)) continue;
        if (!fs.existsSync(deviceIdPath)) continue;
        if (!fs.existsSync(versionPath)) continue;

        let manifest: HenuAiManifest;
        try {
          const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
          manifest = JSON.parse(manifestRaw);
        } catch {
          continue;
        }

        if (!manifest.installation_id || !manifest.engine_name || !manifest.version) {
          continue;
        }

        let deviceId = '';
        try {
          deviceId = fs.readFileSync(deviceIdPath, 'utf-8').trim();
        } catch {
          continue;
        }

        if (deviceId !== manifest.installation_id) {
          continue;
        }

        let version = '';
        try {
          version = fs.readFileSync(versionPath, 'utf-8').trim();
        } catch {
          continue;
        }

        if (!version) continue;

        const modelsDir = path.join(henuAiRoot, manifest.directories?.models || 'models');
        if (!fs.existsSync(modelsDir)) continue;

        this.cachedManifest = manifest;
        this.cachedDeviceId = deviceId;

        return {
          rootPath: henuAiRoot,
          driveLetter: drive,
          isValid: true,
        };
      } catch {
        continue;
      }
    }

    this.cachedManifest = null;
    this.cachedDeviceId = '';
    return { rootPath: '', driveLetter: '', isValid: false };
  }

  /**
   * Validates engine presence, models, checks / spawns background service daemon.
   */
  public detectAndValidate(): HenuAiEngineStatusReport {
    this.lastHealthCheckTime = new Date().toISOString();
    const { rootPath, driveLetter, isValid } = this.detectUsbEngineRoot();

    this.detectedEngineRoot = rootPath;
    this.detectedDriveLetter = driveLetter;

    if (!isValid || !rootPath) {
      this.handleUsbDisconnection();
      return this.getStatusReport();
    }

    const modelsDir = path.join(rootPath, this.cachedManifest?.directories?.models || 'models');
    const glmExists = fs.existsSync(path.join(modelsDir, 'glm-ocr')) || fs.existsSync(path.join(modelsDir, 'GLM-OCR'));
    const fireRedExists = fs.existsSync(path.join(modelsDir, 'firered-ocr')) || fs.existsSync(path.join(modelsDir, 'FireRed-OCR'));

    if (!glmExists && !fireRedExists) {
      this.currentState = 'MODEL_MISSING';
      return this.getStatusReport();
    }

    if (!this.isEngineOn) {
      this.currentState = 'ENGINE_OFF';
      return this.getStatusReport();
    }

    // Valid USB and models found — set initial validating/starting state and verify daemon
    this.currentState = 'SERVICE_STARTING';
    this.checkOrStartService();

    return this.getStatusReport();
  }

  /**
   * Health-check and auto-launcher for USB AI daemon.
   */
  public async checkOrStartService(): Promise<void> {
    if (!this.detectedEngineRoot || !this.isEngineOn) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const res = await fetch('http://127.0.0.1:8080/health', {
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (res && res.ok) {
        const json: any = await res.json().catch(() => ({}));
        if (json.status === 'MODEL_LOADING') {
          this.currentState = 'MODEL_LOADING';
        } else {
          this.currentState = 'ENGINE_READY';
        }
        this.isStartingService = false;
        return;
      }
    } catch {
      // Endpoint not reachable yet
    }

    // If not reachable and not already starting, launch the daemon from verified USB
    if (!this.isStartingService && this.detectedEngineRoot) {
      this.isStartingService = true;
      this.currentState = 'SERVICE_STARTING';

      const pyExe = path.join(this.detectedEngineRoot, 'runtime', 'python', 'python.exe');
      const servicePy = path.join(this.detectedEngineRoot, 'service', 'henu_ai_service.py');

      if (fs.existsSync(pyExe) && fs.existsSync(servicePy)) {
        const tempDir = path.join(this.detectedEngineRoot, 'temp');
        const stateDir = path.join(this.detectedEngineRoot, 'state');
        const cacheDir = path.join(this.detectedEngineRoot, 'cache');

        [tempDir, stateDir, cacheDir].forEach(d => {
          if (!fs.existsSync(d)) {
            try { fs.mkdirSync(d, { recursive: true }); } catch { }
          }
        });

        try {
          const child = spawn(pyExe, [servicePy, '--port', '8080'], {
            cwd: this.detectedEngineRoot,
            env: {
              ...process.env,
              TEMP: tempDir,
              TMP: tempDir,
              LOCALAPPDATA: stateDir,
              APPDATA: stateDir,
              HF_HOME: cacheDir,
              TORCH_HOME: cacheDir,
              PYTHONNOUSERSITE: '1',
              HF_HUB_OFFLINE: '1',
              TRANSFORMERS_OFFLINE: '1',
            },
            stdio: 'ignore',
            detached: false,
          });

          child.on('error', (err) => {
            console.error('HENU AI Service spawn error:', err);
            this.currentState = 'RUNTIME_ERROR';
            this.isStartingService = false;
          });

          child.on('exit', () => {
            this.serviceProcess = null;
            if (this.currentState === 'ENGINE_READY' || this.currentState === 'SERVICE_STARTING' || this.currentState === 'MODEL_LOADING') {
              this.currentState = 'ENGINE_ERROR';
            }
            this.isStartingService = false;
          });

          this.serviceProcess = child;
        } catch (err) {
          console.error('Failed to spawn HENU AI USB Service:', err);
          this.currentState = 'RUNTIME_ERROR';
          this.isStartingService = false;
        }
      } else {
        this.currentState = 'MODEL_MISSING';
        this.isStartingService = false;
      }
    }
  }

  /**
   * Periodically monitors USB presence and service health.
   */
  private startPresenceWatcher(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = setInterval(() => {
      try {
        if (this.detectedEngineRoot && this.detectedEngineRoot.length > 0) {
          if (!fs.existsSync(this.detectedEngineRoot)) {
            this.handleUsbDisconnection();
          } else if (this.isEngineOn) {
            this.checkOrStartService();
          }
        } else if (this.currentState === 'USB_NOT_DETECTED') {
          this.detectAndValidate();
        }
      } catch {
        this.handleUsbDisconnection();
      }
    }, 2500);
  }

  /**
   * Safe USB Disconnection Handler:
   * - Immediately halts any spawned child process
   * - Clears cached USB credentials
   * - Locks OCR state
   */
  public handleUsbDisconnection(): void {
    if (this.serviceProcess) {
      try {
        this.serviceProcess.kill();
      } catch { }
      this.serviceProcess = null;
    }
    this.currentState = 'USB_NOT_DETECTED';
    this.detectedEngineRoot = '';
    this.detectedDriveLetter = '';
    this.cachedManifest = null;
    this.cachedDeviceId = '';
    this.isStartingService = false;
    this.lastHealthCheckTime = new Date().toISOString();
  }

  /**
   * Shuts down any running service process (e.g. on application quit).
   */
  public shutdown(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.serviceProcess) {
      try {
        this.serviceProcess.kill();
      } catch { }
      this.serviceProcess = null;
    }
  }

  /**
   * Toggles the HENU AI Engine ON / OFF.
   */
  public setEnginePower(powerOn: boolean): HenuAiEngineStatusReport {
    this.isEngineOn = powerOn;
    if (!powerOn) {
      if (this.serviceProcess) {
        try { this.serviceProcess.kill(); } catch { }
        this.serviceProcess = null;
      }
      this.currentState = this.detectedEngineRoot ? 'ENGINE_OFF' : 'USB_NOT_DETECTED';
    } else {
      this.detectAndValidate();
    }
    return this.getStatusReport();
  }

  /**
   * Validates whether OCR execution is authorized.
   */
  public validateOcrAuthorization(): { authorized: boolean; reason: string } {
    if (this.currentState === 'USB_NOT_DETECTED' || !this.detectedEngineRoot) {
      return { authorized: false, reason: 'HENU AI USB NOT CONNECTED. Connect the HENU AI USB to use OCR. The AI engine and OCR models are available only from the connected HENU AI USB.' };
    }
    if (this.currentState === 'MODEL_MISSING') {
      return { authorized: false, reason: 'Required OCR models are missing from the HENU AI USB. Please verify the USB contents.' };
    }
    if (this.currentState === 'ENGINE_OFF') {
      return { authorized: false, reason: 'HENU AI Engine is switched OFF. Turn ON before processing vouchers.' };
    }
    if (this.currentState === 'SERVICE_STARTING' || this.currentState === 'MODEL_LOADING') {
      return { authorized: false, reason: 'HENU AI Engine is currently initializing / loading models. Please wait a moment.' };
    }
    if (this.currentState === 'ENGINE_ERROR' || this.currentState === 'RUNTIME_ERROR') {
      return { authorized: false, reason: 'HENU AI Engine has encountered an error. Please reconnect the USB or restart.' };
    }
    if (this.currentState !== 'ENGINE_READY') {
      return { authorized: false, reason: `HENU AI Engine is not ready (state: ${this.currentState}).` };
    }
    return { authorized: true, reason: 'OCR authorized — USB validated, engine ready.' };
  }

  public incrementActiveJobs(): void {
    this.activeJobsCount++;
  }

  public decrementActiveJobs(): void {
    this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
  }

  /**
   * Helper to wait for the USB service to become ENGINE_READY.
   */
  public async waitForReady(timeoutMs: number = 45000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      await this.checkOrStartService();
      const curr: any = this.currentState;
      if (curr === 'ENGINE_READY') return true;
      if (curr === 'USB_NOT_DETECTED' || curr === 'ENGINE_ERROR' || curr === 'RUNTIME_ERROR' || curr === 'MODEL_MISSING') {
        return false;
      }
      await new Promise(res => setTimeout(res, 500));
    }
    return this.currentState === 'ENGINE_READY';
  }

  /**
   * Dispatches voucher image bytes directly to the USB HENU AI Service daemon.
   */
  public async processVoucher(payload: { base64Image: string; fileName?: string; languages?: string[] }): Promise<any> {
    // If service is starting, model loading, or validating, wait for ENGINE_READY
    if (this.currentState !== 'ENGINE_READY' && this.detectedEngineRoot) {
      await this.waitForReady(45000);
    }

    const auth = this.validateOcrAuthorization();
    if (!auth.authorized) {
      throw new Error(auth.reason);
    }

    const imageHash = crypto.createHash('sha256').update(payload.base64Image || '').digest('hex');
    const jobId = `job-${Date.now()}-${uuidv4().substring(0, 8)}`;

    const host = 'http://127.0.0.1:8080';
    const body = JSON.stringify({
      job_id: jobId,
      image_hash: imageHash,
      filename: payload.fileName || 'voucher.jpg',
      image_base64: payload.base64Image,
      languages: payload.languages || ['eng'],
    });

    this.incrementActiveJobs();
    try {
      const result = await new Promise<any>((resolve, reject) => {
        const postData = body;
        const options = {
          hostname: '127.0.0.1',
          port: 8080,
          path: '/ocr',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
          timeout: 300000, // 5 minute timeout for local USB model inference
        };

        const req = http.request(options, (res) => {
          let resBody = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => { resBody += chunk; });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const parsed = JSON.parse(resBody);
                resolve(parsed);
              } catch (parseErr: any) {
                reject(new Error(`Failed to parse USB engine JSON response: ${parseErr.message}`));
              }
            } else {
              reject(new Error(`HENU AI USB engine HTTP error: ${res.statusCode} - ${resBody.substring(0, 200)}`));
            }
          });
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('HENU AI USB Engine OCR processing timed out (exceeded 300s).'));
        });

        req.on('error', (err) => {
          reject(new Error(`HENU AI USB Engine communication failure: ${err.message}`));
        });

        req.write(postData);
        req.end();
      });

      if (result && typeof result === 'object') {
        result.job_id = result.job_id || jobId;
        result.image_hash = result.image_hash || imageHash;
      }
      return result;
    } catch (err: any) {
      throw new Error(`HENU AI USB Engine communication failure: ${err.message}`);
    } finally {
      this.decrementActiveJobs();
    }
  }

  /**
   * Authoritative Engine Status Report
   */
  public getStatusReport(): HenuAiEngineStatusReport {
    const isUsbConnected = this.currentState !== 'USB_NOT_DETECTED' && Boolean(this.detectedEngineRoot);
    const modelsDir = this.detectedEngineRoot
      ? path.join(this.detectedEngineRoot, this.cachedManifest?.directories?.models || 'models')
      : '';
    const tempDir = this.detectedEngineRoot
      ? path.join(this.detectedEngineRoot, this.cachedManifest?.directories?.temp || 'temp')
      : '';

    const glmOcrPath = modelsDir ? path.join(modelsDir, 'GLM-OCR') : '';
    const fireRedOcrPath = modelsDir ? path.join(modelsDir, 'FireRed-OCR') : '';
    const krakenPath = modelsDir ? path.join(modelsDir, 'handwriting', 'kraken-main') : '';
    const llamaPath = modelsDir ? path.join(modelsDir, 'llama', 'Llama-3.2-11B-Vision-Instruct.Q4_K_M.gguf') : '';
    const qwenPath = modelsDir ? path.join(modelsDir, 'qwen3-coder', 'qwen3-coder-30b-a3b-instruct-q4_k_m.gguf') : '';

    const glmExists = glmOcrPath ? fs.existsSync(glmOcrPath) : false;
    const fireRedExists = fireRedOcrPath ? fs.existsSync(fireRedOcrPath) : false;
    const krakenExists = krakenPath ? fs.existsSync(krakenPath) : false;

    const isUsbOperational = isUsbConnected && this.isEngineOn && this.currentState === 'ENGINE_READY';

    let statusMsg = '';
    if (!isUsbConnected) {
      statusMsg = 'HENU AI USB NOT CONNECTED. Connect the HENU AI USB to use OCR. The AI engine and OCR models are available only from the connected HENU AI USB.';
    } else if (this.currentState === 'MODEL_MISSING') {
      statusMsg = 'Required OCR models not found on HENU AI USB. Please verify USB contents.';
    } else if (this.currentState === 'SERVICE_STARTING') {
      statusMsg = 'Starting HENU AI service on USB...';
    } else if (this.currentState === 'MODEL_LOADING') {
      statusMsg = 'Loading OCR models from USB into memory...';
    } else if (!this.isEngineOn) {
      statusMsg = 'HENU AI Engine is manually switched OFF. OCR extraction paused.';
    } else if (this.currentState === 'ENGINE_ERROR' || this.currentState === 'RUNTIME_ERROR') {
      statusMsg = 'HENU AI service encountered an error. Please reconnect the USB.';
    } else {
      statusMsg = 'HENU AI Engine is fully operational and ready.';
    }

    return {
      state: this.currentState,
      isEngineOn: this.isEngineOn,
      isUsbConnected,
      usbDriveLetter: this.detectedDriveLetter,
      engineRootPath: this.detectedEngineRoot,
      modelsDirectory: modelsDir,
      tempDirectory: tempDir,
      runtimeStatus: isUsbOperational ? 'OPERATIONAL' : (this.currentState === 'SERVICE_STARTING' || this.currentState === 'MODEL_LOADING' ? 'INITIALIZING' : 'STANDBY'),
      statusMessage: statusMsg,
      lastHealthCheck: this.lastHealthCheckTime,
      models: {
        tesseract: {
          name: 'HENU Multi-Lingual Engine (USB)',
          key: 'tesseract',
          status: isUsbOperational ? 'READY' : 'DISABLED',
          modelPath: modelsDir ? path.join(modelsDir, 'tessdata') : 'USB NOT CONNECTED',
          lastChecked: this.lastHealthCheckTime,
          isAvailable: isUsbOperational,
        },
        glmOcr: {
          name: 'GLM-OCR Local Sequential Adapter',
          key: 'glmOcr',
          status: glmExists && isUsbConnected && this.isEngineOn ? (this.currentState === 'ENGINE_READY' ? 'READY' : 'STANDBY') : (glmExists ? 'STANDBY' : 'MISSING'),
          modelPath: glmOcrPath || 'NOT FOUND',
          lastChecked: this.lastHealthCheckTime,
          isAvailable: glmExists,
        },
        fireRedOcr: {
          name: 'FireRed-OCR Consensus Adapter',
          key: 'fireRedOcr',
          status: fireRedExists && isUsbConnected && this.isEngineOn ? (this.currentState === 'ENGINE_READY' ? 'READY' : 'STANDBY') : (fireRedExists ? 'STANDBY' : 'MISSING'),
          modelPath: fireRedOcrPath || 'NOT FOUND',
          lastChecked: this.lastHealthCheckTime,
          isAvailable: fireRedExists,
        },
        kraken: {
          name: 'Kraken Document Layout & Handwriting Engine',
          key: 'kraken',
          status: krakenExists && isUsbConnected && this.isEngineOn ? 'READY' : (krakenExists ? 'STANDBY' : 'MISSING'),
          modelPath: krakenPath || 'NOT FOUND',
          lastChecked: this.lastHealthCheckTime,
          isAvailable: krakenExists,
        },
        llamaVision: {
          name: 'Llama-3.2-11B Vision Instruct',
          key: 'llamaVision',
          status: 'BLOCKED',
          modelPath: llamaPath || 'NOT FOUND',
          lastChecked: this.lastHealthCheckTime,
          isAvailable: false,
        },
        qwen3Coder: {
          name: 'Qwen3-Coder-30B Instruct (Chat Assistant)',
          key: 'qwen3Coder',
          status: 'BLOCKED',
          modelPath: qwenPath || 'NOT FOUND',
          lastChecked: this.lastHealthCheckTime,
          isAvailable: false,
        },
      },
      diagnostics: {
        offlineMode: true,
        zeroCloudTelemetry: true,
        activeJobsCount: this.activeJobsCount,
        memoryCleanupEnabled: true,
        sequentialExecution: true,
      },
      usbIdentity: this.cachedManifest ? {
        installationId: this.cachedDeviceId,
        version: this.cachedManifest.version,
        engineName: this.cachedManifest.engine_name,
        manifestValid: true,
      } : undefined,
    };
  }
}

