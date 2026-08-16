import { getFrontendSupabaseClient } from './supabaseFrontend';
import { fetchCloudData } from './api';

let activeRealtimeChannel: any = null;
let currentSubscribedCode: string = '';
let broadcastChannel: BroadcastChannel | null = null;

// Unique ID for this browser tab / mobile instance (Must be per-tab, NOT shared across tabs in localStorage)
const RUNTIME_INSTANCE_ID = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);

export function getOrCreateDeviceId(): string {
  try {
    let devId = sessionStorage.getItem('fire_tab_instance_id');
    if (!devId) {
      devId = RUNTIME_INSTANCE_ID;
      sessionStorage.setItem('fire_tab_instance_id', devId);
    }
    return devId;
  } catch (e) {
    return RUNTIME_INSTANCE_ID;
  }
}

/**
 * 訂閱即時雲端同步 (WebSocket Realtime + Local BroadcastChannel)
 */
export function subscribeToRealtimeSync(
  syncCode: string,
  onRemoteChange: (sourceDeviceId?: string) => void
): () => void {
  const cleanCode = (syncCode || 'FIRE-DEFAULT-2026').trim().toUpperCase();
  const myDeviceId = getOrCreateDeviceId();

  // 1. 本地多分頁 BroadcastChannel
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      if (broadcastChannel) {
        broadcastChannel.close();
      }
      broadcastChannel = new BroadcastChannel(`fire_flow_sync_${cleanCode}`);
      broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.deviceId !== myDeviceId) {
          onRemoteChange(event.data.deviceId);
        }
      };
    }
  } catch (e) {}

  // 2. Supabase 雲端 WebSocket Realtime 頻道
  const supabase = getFrontendSupabaseClient();
  if (supabase) {
    try {
      if (activeRealtimeChannel) {
        supabase.removeChannel(activeRealtimeChannel);
        activeRealtimeChannel = null;
      }

      currentSubscribedCode = cleanCode;
      const channelName = `realtime_fire_${cleanCode}`;

      activeRealtimeChannel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: false },
          },
        })
        .on('broadcast', { event: 'FIRE_DATA_UPDATED' }, (payload: any) => {
          if (payload && payload.payload && payload.payload.deviceId !== myDeviceId) {
            onRemoteChange(payload.payload.deviceId);
          }
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            // Realtime Connected
          }
        });
    } catch (e) {
      console.warn('Realtime subscription warning:', e);
    }
  }

  // Cleanup function
  return () => {
    if (broadcastChannel) {
      broadcastChannel.close();
      broadcastChannel = null;
    }
    if (supabase && activeRealtimeChannel) {
      supabase.removeChannel(activeRealtimeChannel);
      activeRealtimeChannel = null;
    }
  };
}

/**
 * 當本機資料發生任何變更時，立即向全體裝置廣播推播
 */
export function broadcastDataSyncEvent(syncCode: string): void {
  const cleanCode = (syncCode || 'FIRE-DEFAULT-2026').trim().toUpperCase();
  const myDeviceId = getOrCreateDeviceId();

  // 1. 本地多分頁廣播
  try {
    if (broadcastChannel) {
      broadcastChannel.postMessage({
        type: 'FIRE_DATA_UPDATED',
        deviceId: myDeviceId,
        timestamp: Date.now(),
        syncCode: cleanCode,
      });
    }
  } catch (e) {}

  // 2. Supabase 雲端廣播
  try {
    if (activeRealtimeChannel) {
      activeRealtimeChannel.send({
        type: 'broadcast',
        event: 'FIRE_DATA_UPDATED',
        payload: {
          deviceId: myDeviceId,
          timestamp: Date.now(),
          syncCode: cleanCode,
        },
      });
    }
  } catch (e) {}
}
