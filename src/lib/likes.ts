import { supabase } from './supabase';

export interface LikeInfo {
  count: number;
  liked: boolean;
}
export type LikesMap = Record<string, LikeInfo>;

const VOTER_KEY = 'stratum-voter-id';

const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

let memoryVoterId: string | null = null;

/** Анонимный идентификатор этого браузера (хранится в localStorage). */
export function getVoterId(): string {
  try {
    let id = localStorage.getItem(VOTER_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(VOTER_KEY, id);
    }
    return id;
  } catch {
    // localStorage недоступен (например, приватный режим): держим id до перезагрузки
    if (!memoryVoterId) memoryVoterId = uuid();
    return memoryVoterId;
  }
}

export async function fetchLikes(): Promise<LikesMap> {
  const { data, error } = await supabase.rpc('get_strategy_likes', {
    p_voter: getVoterId()
  });
  if (error) throw error;
  const map: LikesMap = {};
  for (const row of (data ?? []) as Array<{
    out_strategy_id: string;
    out_count: number | string;
    out_liked: boolean;
  }>) {
    map[row.out_strategy_id] = {
      count: Number(row.out_count),
      liked: row.out_liked
    };
  }
  return map;
}

export async function toggleLike(strategyId: string): Promise<LikeInfo> {
  const { data, error } = await supabase.rpc('toggle_strategy_like', {
    p_strategy: strategyId,
    p_voter: getVoterId()
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as {
    out_count: number | string;
    out_liked: boolean;
  };
  return { count: Number(row.out_count), liked: row.out_liked };
}
