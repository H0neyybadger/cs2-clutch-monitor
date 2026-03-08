import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export interface AudioSessionSnapshot {
  sessionKey: string;
  processId: number;
  processName: string;
  displayName: string;
  sessionIdentifier: string;
  sessionInstanceIdentifier: string;
  volume: number;
  muted: boolean;
}

interface RawAudioSessionSnapshot {
  SessionKey?: string;
  ProcessId?: number;
  ProcessName?: string;
  DisplayName?: string;
  SessionIdentifier?: string;
  SessionInstanceIdentifier?: string;
  Volume?: number;
  IsMuted?: boolean;
}

const AUDIO_SESSION_BRIDGE = String.raw`
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace CascadeAudio
{
    public class AudioSessionInfo
    {
        public AudioSessionInfo()
        {
            ProcessName = string.Empty;
            DisplayName = string.Empty;
            SessionIdentifier = string.Empty;
            SessionInstanceIdentifier = string.Empty;
            SessionKey = string.Empty;
        }

        public int ProcessId { get; set; }
        public string ProcessName { get; set; }
        public string DisplayName { get; set; }
        public string SessionIdentifier { get; set; }
        public string SessionInstanceIdentifier { get; set; }
        public float Volume { get; set; }
        public bool IsMuted { get; set; }
        public string SessionKey { get; set; }
    }

    [ComImport]
    [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    internal class MMDeviceEnumeratorComObject
    {
    }

    internal enum EDataFlow
    {
        eRender = 0,
        eCapture = 1,
        eAll = 2
    }

    internal enum ERole
    {
        eConsole = 0,
        eMultimedia = 1,
        eCommunications = 2
    }

    [ComImport]
    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDeviceEnumerator
    {
        [PreserveSig]
        int EnumAudioEndpoints(EDataFlow dataFlow, int dwStateMask, out object ppDevices);

        [PreserveSig]
        int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice ppDevice);

        [PreserveSig]
        int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string pwstrId, out IMMDevice ppDevice);

        [PreserveSig]
        int RegisterEndpointNotificationCallback(IntPtr pClient);

        [PreserveSig]
        int UnregisterEndpointNotificationCallback(IntPtr pClient);
    }

    [ComImport]
    [Guid("D666063F-1587-4E43-81F1-B948E807363F")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDevice
    {
        [PreserveSig]
        int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);

        [PreserveSig]
        int OpenPropertyStore(int stgmAccess, out object ppProperties);

        [PreserveSig]
        int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);

        [PreserveSig]
        int GetState(out int pdwState);
    }

    [ComImport]
    [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionManager2
    {
        [PreserveSig]
        int GetAudioSessionControl(IntPtr AudioSessionGuid, int StreamFlags, out IAudioSessionControl SessionControl);

        [PreserveSig]
        int GetSimpleAudioVolume(IntPtr AudioSessionGuid, uint StreamFlags, out ISimpleAudioVolume AudioVolume);

        [PreserveSig]
        int GetSessionEnumerator(out IAudioSessionEnumerator SessionEnum);

        [PreserveSig]
        int RegisterSessionNotification(IntPtr SessionNotification);

        [PreserveSig]
        int UnregisterSessionNotification(IntPtr SessionNotification);

        [PreserveSig]
        int RegisterDuckNotification([MarshalAs(UnmanagedType.LPWStr)] string sessionID, IntPtr duckNotification);

        [PreserveSig]
        int UnregisterDuckNotification(IntPtr duckNotification);
    }

    [ComImport]
    [Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionEnumerator
    {
        [PreserveSig]
        int GetCount(out int SessionCount);

        [PreserveSig]
        int GetSession(int SessionCount, out IAudioSessionControl Session);
    }

    [ComImport]
    [Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionControl
    {
        [PreserveSig]
        int GetState(out int pRetVal);

        [PreserveSig]
        int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);

        [PreserveSig]
        int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string Value, IntPtr EventContext);

        [PreserveSig]
        int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);

        [PreserveSig]
        int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string Value, IntPtr EventContext);

        [PreserveSig]
        int GetGroupingParam(out Guid pRetVal);

        [PreserveSig]
        int SetGroupingParam(ref Guid Override, IntPtr EventContext);

        [PreserveSig]
        int RegisterAudioSessionNotification(IntPtr NewNotifications);

        [PreserveSig]
        int UnregisterAudioSessionNotification(IntPtr NewNotifications);
    }

    [ComImport]
    [Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionControl2
    {
        [PreserveSig]
        int GetState(out int pRetVal);

        [PreserveSig]
        int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);

        [PreserveSig]
        int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string Value, IntPtr EventContext);

        [PreserveSig]
        int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);

        [PreserveSig]
        int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string Value, IntPtr EventContext);

        [PreserveSig]
        int GetGroupingParam(out Guid pRetVal);

        [PreserveSig]
        int SetGroupingParam(ref Guid Override, IntPtr EventContext);

        [PreserveSig]
        int RegisterAudioSessionNotification(IntPtr NewNotifications);

        [PreserveSig]
        int UnregisterAudioSessionNotification(IntPtr NewNotifications);

        [PreserveSig]
        int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);

        [PreserveSig]
        int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);

        [PreserveSig]
        int GetProcessId(out uint pRetVal);

        [PreserveSig]
        int IsSystemSoundsSession();

        [PreserveSig]
        int SetDuckingPreference([MarshalAs(UnmanagedType.Bool)] bool optOut);
    }

    [ComImport]
    [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface ISimpleAudioVolume
    {
        [PreserveSig]
        int SetMasterVolume(float fLevel, ref Guid EventContext);

        [PreserveSig]
        int GetMasterVolume(out float pfLevel);

        [PreserveSig]
        int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid EventContext);

        [PreserveSig]
        int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
    }

    public static class AudioSessionBridge
    {
        private const int CLSCTX_ALL = 23;

        private static IAudioSessionEnumerator GetSessionEnumerator()
        {
            IMMDeviceEnumerator deviceEnumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
            IMMDevice speakers;
            Marshal.ThrowExceptionForHR(deviceEnumerator.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out speakers));
            Guid iid = typeof(IAudioSessionManager2).GUID;
            object managerObject;
            Marshal.ThrowExceptionForHR(speakers.Activate(ref iid, CLSCTX_ALL, IntPtr.Zero, out managerObject));
            IAudioSessionManager2 manager = (IAudioSessionManager2)managerObject;
            IAudioSessionEnumerator sessionEnumerator;
            Marshal.ThrowExceptionForHR(manager.GetSessionEnumerator(out sessionEnumerator));
            return sessionEnumerator;
        }

        private static string SafeString(string value)
        {
            return value ?? string.Empty;
        }

        private static string ComposeSessionKey(int processId, string sessionIdentifier, string sessionInstanceIdentifier)
        {
            if (!string.IsNullOrWhiteSpace(sessionInstanceIdentifier))
            {
                return sessionInstanceIdentifier;
            }

            if (!string.IsNullOrWhiteSpace(sessionIdentifier))
            {
                return sessionIdentifier;
            }

            return processId.ToString();
        }

        public static List<AudioSessionInfo> GetSessions(string processName)
        {
            List<AudioSessionInfo> sessions = new List<AudioSessionInfo>();
            IAudioSessionEnumerator sessionEnumerator = GetSessionEnumerator();
            int sessionCount;
            Marshal.ThrowExceptionForHR(sessionEnumerator.GetCount(out sessionCount));

            for (int index = 0; index < sessionCount; index++)
            {
                IAudioSessionControl sessionControl;
                if (sessionEnumerator.GetSession(index, out sessionControl) != 0 || sessionControl == null)
                {
                    continue;
                }

                IAudioSessionControl2 sessionControl2 = sessionControl as IAudioSessionControl2;
                ISimpleAudioVolume simpleAudioVolume = sessionControl as ISimpleAudioVolume;
                if (sessionControl2 == null || simpleAudioVolume == null)
                {
                    continue;
                }

                uint processId;
                if (sessionControl2.GetProcessId(out processId) != 0 || processId == 0)
                {
                    continue;
                }

                Process process;
                try
                {
                    process = Process.GetProcessById((int)processId);
                }
                catch
                {
                    continue;
                }

                if (!string.Equals(process.ProcessName, processName, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                float volumeLevel;
                if (simpleAudioVolume.GetMasterVolume(out volumeLevel) != 0)
                {
                    continue;
                }

                bool muted = false;
                simpleAudioVolume.GetMute(out muted);

                string displayName;
                string sessionIdentifier;
                string sessionInstanceIdentifier;
                sessionControl2.GetDisplayName(out displayName);
                sessionControl2.GetSessionIdentifier(out sessionIdentifier);
                sessionControl2.GetSessionInstanceIdentifier(out sessionInstanceIdentifier);

                sessions.Add(new AudioSessionInfo
                {
                    ProcessId = (int)processId,
                    ProcessName = SafeString(process.ProcessName),
                    DisplayName = string.IsNullOrWhiteSpace(displayName) ? SafeString(process.ProcessName) : displayName,
                    SessionIdentifier = SafeString(sessionIdentifier),
                    SessionInstanceIdentifier = SafeString(sessionInstanceIdentifier),
                    Volume = (float)Math.Round(volumeLevel * 100.0f, 2),
                    IsMuted = muted,
                    SessionKey = ComposeSessionKey((int)processId, SafeString(sessionIdentifier), SafeString(sessionInstanceIdentifier))
                });
            }

            return sessions;
        }

        public static bool SetSessionVolume(string processName, int processId, string sessionInstanceIdentifier, string sessionIdentifier, float volume)
        {
            IAudioSessionEnumerator sessionEnumerator = GetSessionEnumerator();
            int sessionCount;
            Marshal.ThrowExceptionForHR(sessionEnumerator.GetCount(out sessionCount));
            float targetVolume = Math.Max(0.0f, Math.Min(1.0f, volume));
            Guid eventContext = Guid.Empty;
            bool updated = false;

            for (int index = 0; index < sessionCount; index++)
            {
                IAudioSessionControl sessionControl;
                if (sessionEnumerator.GetSession(index, out sessionControl) != 0 || sessionControl == null)
                {
                    continue;
                }

                IAudioSessionControl2 sessionControl2 = sessionControl as IAudioSessionControl2;
                ISimpleAudioVolume simpleAudioVolume = sessionControl as ISimpleAudioVolume;
                if (sessionControl2 == null || simpleAudioVolume == null)
                {
                    continue;
                }

                uint currentProcessId;
                if (sessionControl2.GetProcessId(out currentProcessId) != 0 || currentProcessId == 0)
                {
                    continue;
                }

                if (processId > 0 && currentProcessId != (uint)processId)
                {
                    continue;
                }

                Process process;
                try
                {
                    process = Process.GetProcessById((int)currentProcessId);
                }
                catch
                {
                    continue;
                }

                if (!string.Equals(process.ProcessName, processName, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                string currentSessionIdentifier;
                string currentSessionInstanceIdentifier;
                sessionControl2.GetSessionIdentifier(out currentSessionIdentifier);
                sessionControl2.GetSessionInstanceIdentifier(out currentSessionInstanceIdentifier);

                bool matchesInstance = !string.IsNullOrWhiteSpace(sessionInstanceIdentifier) && string.Equals(SafeString(currentSessionInstanceIdentifier), sessionInstanceIdentifier, StringComparison.OrdinalIgnoreCase);
                bool matchesIdentifier = !string.IsNullOrWhiteSpace(sessionIdentifier) && string.Equals(SafeString(currentSessionIdentifier), sessionIdentifier, StringComparison.OrdinalIgnoreCase);
                bool matchesFallback = string.IsNullOrWhiteSpace(sessionInstanceIdentifier) && string.IsNullOrWhiteSpace(sessionIdentifier);

                if (!matchesInstance && !matchesIdentifier && !matchesFallback)
                {
                    continue;
                }

                if (simpleAudioVolume.SetMasterVolume(targetVolume, ref eventContext) == 0)
                {
                    updated = true;
                }
            }

            return updated;
        }
    }
}
`;

const BRIDGE_DIRECTORY = join(tmpdir(), 'cs2-clutch-monitor');
const BRIDGE_PATH = join(BRIDGE_DIRECTORY, 'audio-session-bridge.cs');

function escapePowerShellString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function encodePowerShellCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function ensureBridgeSourceFile(): string {
  if (!existsSync(BRIDGE_DIRECTORY)) {
    mkdirSync(BRIDGE_DIRECTORY, { recursive: true });
  }

  writeFileSync(BRIDGE_PATH, AUDIO_SESSION_BRIDGE, 'utf8');
  return BRIDGE_PATH;
}

function buildBootstrapScript(): string {
  const bridgePath = ensureBridgeSourceFile();

  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    `$bridgePath = ${escapePowerShellString(bridgePath)}`,
    "if (-not ('CascadeAudio.AudioSessionBridge' -as [type])) {",
    '  Add-Type -Path $bridgePath',
    '}',
  ].join('\n');
}

function normalizeJsonArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function normalizeSession(session: RawAudioSessionSnapshot): AudioSessionSnapshot {
  return {
    sessionKey: session.SessionKey || '',
    processId: session.ProcessId || 0,
    processName: session.ProcessName || '',
    displayName: session.DisplayName || '',
    sessionIdentifier: session.SessionIdentifier || '',
    sessionInstanceIdentifier: session.SessionInstanceIdentifier || '',
    volume: typeof session.Volume === 'number' ? session.Volume : 0,
    muted: Boolean(session.IsMuted),
  };
}

function clampPercent(volume: number): number {
  if (!Number.isFinite(volume)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(volume)));
}

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodePowerShellCommand(script)],
      { windowsHide: true }
    );

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    process.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    process.on('error', reject);

    process.on('close', code => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim() || `PowerShell exited with code ${code ?? 'unknown'}`));
    });
  });
}

export async function listProcessAudioSessions(processName: string): Promise<AudioSessionSnapshot[]> {
  const script = [
    buildBootstrapScript(),
    `$sessions = [CascadeAudio.AudioSessionBridge]::GetSessions(${escapePowerShellString(processName)})`,
    'if ($null -eq $sessions) {',
    "  Write-Output '[]'",
    '} else {',
    '  $sessions | ConvertTo-Json -Depth 6 -Compress',
    '}',
  ].join('\n');

  const output = await runPowerShell(script);
  if (!output || output === 'null') {
    return [];
  }

  const parsed = JSON.parse(output) as RawAudioSessionSnapshot | RawAudioSessionSnapshot[];
  return normalizeJsonArray(parsed).map(normalizeSession);
}

export async function setProcessAudioSessionVolumes(sessions: AudioSessionSnapshot[]): Promise<number> {
  if (sessions.length === 0) {
    return 0;
  }

  const payload = sessions.map(session => ({
    processName: session.processName,
    processId: session.processId,
    sessionIdentifier: session.sessionIdentifier,
    sessionInstanceIdentifier: session.sessionInstanceIdentifier,
    volume: clampPercent(session.volume) / 100,
  }));

  const script = [
    buildBootstrapScript(),
    `$payload = ${escapePowerShellString(JSON.stringify(payload))} | ConvertFrom-Json`,
    '$updated = 0',
    'foreach ($entry in @($payload)) {',
    '  if ([CascadeAudio.AudioSessionBridge]::SetSessionVolume([string]$entry.processName, [int]$entry.processId, [string]$entry.sessionInstanceIdentifier, [string]$entry.sessionIdentifier, [single]([double]$entry.volume))) {',
    '    $updated++',
    '  }',
    '}',
    'Write-Output $updated',
  ].join('\n');

  const output = await runPowerShell(script);
  const updated = parseInt(output, 10);
  return Number.isFinite(updated) ? updated : 0;
}
