import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  society: {
    list: (): Promise<any[]> => ipcRenderer.invoke('society:list'),
    getActive: (): Promise<any> => ipcRenderer.invoke('society:getActive'),
    create: (payload: any): Promise<any> => ipcRenderer.invoke('society:create', payload),
    select: (societyId: string): Promise<any> => ipcRenderer.invoke('society:select', societyId),
    setActive: (societyId: string): Promise<any> => ipcRenderer.invoke('society:select', societyId),
    delete: (societyId: string): Promise<any> => ipcRenderer.invoke('society:delete', societyId),
    updateLogo: (societyId: string, logoBase64: string): Promise<any> => ipcRenderer.invoke('society:updateLogo', societyId, logoBase64),
  },
  foundation: {
    getStatus: (): Promise<any> => ipcRenderer.invoke('foundation:getStatus'),
  },
  settings: {
    get: (key: string, defaultValue?: string): Promise<string> =>
      ipcRenderer.invoke('settings:get', key, defaultValue),
    set: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke('settings:set', key, value),
    list: (): Promise<{ key: string; value: string }[]> =>
      ipcRenderer.invoke('settings:list'),
    getFormSettings: (formId: string): Promise<any> =>
      ipcRenderer.invoke('settings:getFormSettings', formId),
    saveFormSettings: (formId: string, settings: any): Promise<any> =>
      ipcRenderer.invoke('settings:saveFormSettings', formId, settings),
    resetFormSettings: (formId: string): Promise<any> =>
      ipcRenderer.invoke('settings:resetFormSettings', formId),
    resetGlobalSettings: (): Promise<any> =>
      ipcRenderer.invoke('settings:resetGlobalSettings'),
  },
  masterData: {
    downloadTemplate: (): Promise<string | null> =>
      ipcRenderer.invoke('masterData:downloadTemplate'),
    downloadMasterTemplate: (): Promise<string | null> =>
      ipcRenderer.invoke('masterData:downloadMasterTemplate'),
    exportMaster: (): Promise<string | null> =>
      ipcRenderer.invoke('masterData:exportMaster'),
    downloadModuleTemplate: (moduleId: string): Promise<string | null> =>
      ipcRenderer.invoke('masterData:downloadModuleTemplate', moduleId),
    exportModule: (moduleId: string): Promise<string | null> =>
      ipcRenderer.invoke('masterData:exportModule', moduleId),
    importModule: (moduleId: string): Promise<any | null> =>
      ipcRenderer.invoke('masterData:importModule', moduleId),
    getMembersList: (): Promise<any[]> =>
      ipcRenderer.invoke('masterData:getMembersList'),
    updateMemberRecord: (record: any): Promise<any | null> =>
      ipcRenderer.invoke('masterData:updateMemberRecord', record),
    upload: (): Promise<any | null> =>
      ipcRenderer.invoke('masterData:upload'),
    getStatus: (): Promise<any | null> =>
      ipcRenderer.invoke('masterData:getStatus'),
    clear: (): Promise<void> =>
      ipcRenderer.invoke('masterData:clear'),
    getFormDetails: (formId: string): Promise<any | null> =>
      ipcRenderer.invoke('masterData:getFormDetails', formId),
    getWorkbook: (): Promise<any | null> =>
      ipcRenderer.invoke('masterData:getWorkbook'),
    updateWorkbook: (workbook: any): Promise<any | null> =>
      ipcRenderer.invoke('masterData:updateWorkbook', workbook),
  },
  generate: {
    /** Live count preview (fast — no PDF generation) */
    getPreviewRange: (...args: any[]): Promise<any> =>
      ipcRenderer.invoke('generate:preview', ...args),
    preview: (...args: any[]): Promise<any> =>
      ipcRenderer.invoke('generate:preview', ...args),
    /**
     * Generates a preview PDF using the EXACT same engine as execute.
     * Returns a file:// URL for displaying in an iframe.
     * Spec 33: One pipeline — preview === final PDF.
     */
    previewPdf: (...args: any[]): Promise<any> =>
      ipcRenderer.invoke('generate:previewPdf', ...args),
    /**
     * Generates the final ZIP and a preview PDF simultaneously.
     * Returns zipPath + previewPdfUrl.
     */
    execute: (...args: any[]): Promise<any> =>
      ipcRenderer.invoke('generate:execute', ...args),
    onProgress: (callback: (msg: string) => void): void => {
      ipcRenderer.on('generate:progress', (_e, msg) => callback(msg));
    },
    removeProgressListener: (): void => {
      ipcRenderer.removeAllListeners('generate:progress');
    },
  },
  history: {
    list: (): Promise<any[]> => ipcRenderer.invoke('history:list'),
    clear: (): Promise<void> => ipcRenderer.invoke('history:clear'),
  },
  calibration: {
    getTemplates: (): Promise<any> => ipcRenderer.invoke('calibration:getTemplates'),
  },
  tests: {
    run: (): Promise<any> => ipcRenderer.invoke('tests:run'),
  },
  file: {
    openPath: (p: string): Promise<void> => ipcRenderer.invoke('system:openPath', p),
    showItemInFolder: (p: string): Promise<void> => ipcRenderer.invoke('system:showItemInFolder', p),
  },
  system: {
    getPaths: (): Promise<any> => ipcRenderer.invoke('system:getPaths'),
    getAppInfo: (): Promise<any> => ipcRenderer.invoke('system:getAppInfo'),
    openPath: (p: string): Promise<void> => ipcRenderer.invoke('system:openPath', p),
    showItemInFolder: (p: string): Promise<void> => ipcRenderer.invoke('system:showItemInFolder', p),
    openFileDialog: (options: any): Promise<string | null> => ipcRenderer.invoke('system:openFileDialog', options),
    showSaveDialog: (options: any): Promise<string | null> => ipcRenderer.invoke('system:showSaveDialog', options),
  },
  henuAi: {
    getStatus: (): Promise<any> => ipcRenderer.invoke('henuAi:getStatus'),
    setPower: (powerOn: boolean): Promise<any> => ipcRenderer.invoke('henuAi:setPower', powerOn),
    detectUsb: (): Promise<any> => ipcRenderer.invoke('henuAi:detectUsb'),
    processVoucher: (payload: { base64Image: string; fileName?: string }): Promise<any> => ipcRenderer.invoke('henuAi:processVoucher', payload),
  },
  voucherParser: {
    processImage: (payload: { base64Image: string; fileName?: string; languages?: string[] }): Promise<any> => ipcRenderer.invoke('voucherParser:processImage', payload),
    getColumnHeaders: (): Promise<string[]> => ipcRenderer.invoke('voucherParser:getColumnHeaders'),
    getEngineStatus: (): Promise<any> => ipcRenderer.invoke('voucherParser:getEngineStatus'),
  },
  ocrApi: {
    getConfig: (): Promise<any> => ipcRenderer.invoke('ocrApi:getConfig'),
    setMode: (mode: string): Promise<any> => ipcRenderer.invoke('ocrApi:setMode', mode),
    setActiveProvider: (providerId: string): Promise<any> => ipcRenderer.invoke('ocrApi:setActiveProvider', providerId),
    saveProviderConfig: (providerId: string, model: string, apiKey?: string): Promise<any> => ipcRenderer.invoke('ocrApi:saveProviderConfig', providerId, model, apiKey),
    testConnection: (providerId: string, apiKey?: string, model?: string): Promise<any> => ipcRenderer.invoke('ocrApi:testConnection', providerId, apiKey, model),
    processVoucher: (imageBase64: string, mimeType?: string, jobId?: string): Promise<any> => ipcRenderer.invoke('ocrApi:processVoucher', imageBase64, mimeType, jobId),
    processCheck: (imageBase64: string, mimeType?: string, jobId?: string): Promise<any> => ipcRenderer.invoke('ocrApi:processCheck', imageBase64, mimeType, jobId),
  },
});


