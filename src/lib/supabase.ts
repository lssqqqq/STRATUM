import { createClient } from '@supabase/supabase-js';
import type { Tactic } from '../types/tds';

// Публичные данные (их безопасно держать в коде сайта).
// Защита данных работает через Row Level Security в самой базе Supabase.
const env = (import.meta as any).env ?? {};

const SUPABASE_URL: string =
  env.VITE_SUPABASE_URL || 'https://ufktokfnuhxmmflreluj.supabase.co';
const SUPABASE_KEY: string =
  env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mzzk1njTnSSWhmoJrZzRpg__dkyXpWr';

// UID админов. Используются только чтобы показать/скрыть кнопки.
// Реальное право писать в базу проверяет RLS на стороне Supabase.
export const ADMIN_UIDS: string[] = [
  '38b1d888-3a7e-4e07-84d0-67eb168b00a8',
  'b64a3199-d350-4183-b457-8cf495b43467'
];
export const isAdminUid = (id?: string | null): boolean =>
  !!id && ADMIN_UIDS.includes(id);

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface StrategyRow {
  id: string;
  title: string;
  description: string | null;
  author: string | null;
  tags: string[] | null;
  google_docs_url: string | null;
  towers: string[] | null;
  created_at: string | null;
}

const fromRow = (r: StrategyRow): Tactic => ({
  id: r.id,
  title: r.title,
  author: r.author || 'Author',
  googleDocsUrl: r.google_docs_url || '',
  tags: r.tags ?? [],
  description: r.description || undefined,
  towers: r.towers ?? [],
  createdAt: r.created_at ? r.created_at.slice(0, 10) : undefined
});

const toRow = (t: Tactic) => ({
  title: t.title,
  description: t.description ?? '',
  author: t.author,
  tags: t.tags,
  google_docs_url: t.googleDocsUrl,
  towers: t.towers ?? []
});

export async function fetchTactics(): Promise<Tactic[]> {
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as StrategyRow[]).map(fromRow);
}

export async function insertTactic(t: Tactic): Promise<Tactic> {
  const { data, error } = await supabase
    .from('strategies')
    .insert(toRow(t))
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as StrategyRow);
}

export async function updateTactic(t: Tactic): Promise<Tactic> {
  const { data, error } = await supabase
    .from('strategies')
    .update(toRow(t))
    .eq('id', t.id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as StrategyRow);
}

export async function deleteTactic(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('strategies')
    .delete()
    .eq('id', id)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Not allowed or already deleted. Are you logged in as admin?');
  }
}
