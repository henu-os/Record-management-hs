import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Society } from '../../main/types';

export interface SocietyContextType {
  activeSocietyId: string;
  activeSocietyName: string;
  activeSocietyRegistrationNumber: string;
  activeSocietyStoragePath: string;
  activeSociety: Society | null;
  societies: Society[];
  contextStatus: 'IDLE' | 'LOADING' | 'READY' | 'SWITCHING' | 'ERROR';
  contextVersion: number;
  contextToken: string;
  switchSociety: (societyId: string) => Promise<boolean>;
  reloadSocieties: () => Promise<void>;
  isRequestValid: (reqSocId: string, reqVersion: number) => boolean;
  openImportsFolder: () => Promise<void>;
  openExportsFolder: () => Promise<void>;
  openSocietyFolder: () => Promise<void>;
}

const SocietyContext = createContext<SocietyContextType | undefined>(undefined);

export const SocietyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [societies, setSocieties] = useState<Society[]>([]);
  const [activeSociety, setActiveSociety] = useState<Society | null>(null);
  const [contextStatus, setContextStatus] = useState<'IDLE' | 'LOADING' | 'READY' | 'SWITCHING' | 'ERROR'>('IDLE');
  const [contextVersion, setContextVersion] = useState<number>(1);
  const [contextToken, setContextToken] = useState<string>('token-init-1');

  const versionRef = useRef<number>(1);
  const activeSocietyIdRef = useRef<string>('');

  const api = (window as any).api;

  const reloadSocieties = useCallback(async () => {
    if (!api || !api.society) return;
    try {
      setContextStatus('LOADING');
      const [socList, activeSoc] = await Promise.all([
        api.society.list(),
        api.society.getActive(),
      ]);

      const validSocList = (socList || []).filter(
        (s: any) => s && s.societyName && !/^\d{4}-\d{2}-\d{2}T/.test(s.societyName)
      );

      const resolvedList = validSocList.length > 0 ? validSocList : (socList || []);
      setSocieties(resolvedList);

      let chosenSoc: Society | null = null;
      if (activeSoc && !/^\d{4}-\d{2}-\d{2}T/.test(activeSoc.societyName)) {
        chosenSoc = activeSoc;
      } else if (resolvedList.length > 0) {
        // Prefer an unlocked society if available
        chosenSoc = resolvedList.find((s: any) => !s.isLocked) || resolvedList[0];
      } else {
        chosenSoc = activeSoc || null;
      }

      setActiveSociety(chosenSoc);
      activeSocietyIdRef.current = chosenSoc?.id || '';

      const nextVer = versionRef.current + 1;
      versionRef.current = nextVer;
      setContextVersion(nextVer);
      setContextToken(`${chosenSoc?.id || 'none'}_v${nextVer}_${Date.now()}`);

      setContextStatus('READY');
    } catch (err) {
      console.error('Failed to load society context:', err);
      setContextStatus('ERROR');
    }
  }, [api]);

  useEffect(() => {
    reloadSocieties();
  }, [reloadSocieties]);

  const switchSociety = useCallback(
    async (societyId: string): Promise<boolean> => {
      if (!societyId || !api || !api.society) return false;
      const target = societies.find(s => s.id === societyId);
      if (target?.isLocked) {
        alert(`Society "${target.societyName}" is LOCKED.\n\nYou cannot switch to, open, or edit a locked society. Please unlock it with a Master Password in HENU MASTER.`);
        return false;
      }
      if (societyId === activeSocietyIdRef.current && contextStatus === 'READY') return true;

      try {
        setContextStatus('SWITCHING');
        const nextVer = versionRef.current + 1;
        versionRef.current = nextVer;
        setContextVersion(nextVer);
        setContextToken(`${societyId}_v${nextVer}_${Date.now()}`);

        const selected = await (api.society.select ? api.society.select(societyId) : api.society.setActive(societyId));
        if (selected) {
          setActiveSociety(selected);
          activeSocietyIdRef.current = selected.id || societyId;
          window.dispatchEvent(new CustomEvent('society-changed', { detail: selected }));
        }

        await reloadSocieties();
        setContextStatus('READY');
        return true;
      } catch (err: any) {
        console.error('Failed to switch society:', err);
        alert(err.message || 'Failed to switch society: Society is locked or inaccessible.');
        setContextStatus('ERROR');
        return false;
      }
    },
    [api, reloadSocieties, contextStatus, societies]
  );

  const isRequestValid = useCallback((reqSocId: string, reqVersion: number): boolean => {
    return (
      reqSocId === activeSocietyIdRef.current &&
      reqVersion === versionRef.current
    );
  }, []);

  const openImportsFolder = useCallback(async () => {
    if (activeSociety?.isLocked) {
      alert('This society is locked. Unlock it in HENU MASTER to access its folders.');
      return;
    }
    if (api?.storage?.openImportsFolder) {
      await api.storage.openImportsFolder();
    }
  }, [api, activeSociety]);

  const openExportsFolder = useCallback(async () => {
    if (activeSociety?.isLocked) {
      alert('This society is locked. Unlock it in HENU MASTER to access its folders.');
      return;
    }
    if (api?.storage?.openExportsFolder) {
      await api.storage.openExportsFolder();
    }
  }, [api, activeSociety]);

  const openSocietyFolder = useCallback(async () => {
    if (activeSociety?.isLocked) {
      alert('This society is locked. Unlock it in HENU MASTER to access its folders.');
      return;
    }
    if (api?.storage?.openSocietyFolder) {
      await api.storage.openSocietyFolder();
    }
  }, [api, activeSociety]);

  const value: SocietyContextType = {
    activeSocietyId: activeSociety?.id || '',
    activeSocietyName: activeSociety?.societyName || '',
    activeSocietyRegistrationNumber: activeSociety?.registrationNo || '',
    activeSocietyStoragePath: (activeSociety as any)?.folderPath || '',
    activeSociety,
    societies,
    contextStatus,
    contextVersion,
    contextToken,
    switchSociety,
    reloadSocieties,
    isRequestValid,
    openImportsFolder,
    openExportsFolder,
    openSocietyFolder,
  };

  return <SocietyContext.Provider value={value}>{children}</SocietyContext.Provider>;
};

export const useSocietyContext = (): SocietyContextType => {
  const context = useContext(SocietyContext);
  if (!context) {
    throw new Error('useSocietyContext must be used within a SocietyProvider');
  }
  return context;
};
