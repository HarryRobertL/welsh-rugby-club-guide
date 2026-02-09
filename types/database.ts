/**
 * Supabase Database type.
 *
 * Placeholder until schema exists. Replace this file with generated types:
 *   npx supabase gen types typescript --project-id <ref> > types/database.ts
 *
 * File: types/database.ts — single source of truth for DB types; imported by lib/supabase.ts.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'supporter' | 'club_admin' | 'referee' | 'league_admin';

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          club_id: string | null;
          created_at: string;
          notify_lineup_published: boolean;
          notify_score_change: boolean;
          notify_full_time: boolean;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          club_id?: string | null;
          created_at?: string;
          notify_lineup_published?: boolean;
          notify_score_change?: boolean;
          notify_full_time?: boolean;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          club_id?: string | null;
          created_at?: string;
          notify_lineup_published?: boolean;
          notify_score_change?: boolean;
          notify_full_time?: boolean;
        };
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          platform?: 'ios' | 'android';
          created_at?: string;
        };
      };
      pending_claims: {
        Row: {
          id: string;
          user_id: string;
          club_id: string;
          requester_email: string | null;
          status: string;
          created_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          club_id: string;
          requester_email?: string | null;
          status?: string;
          created_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          club_id?: string;
          requester_email?: string | null;
          status?: string;
          created_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
        };
      };
      ingest_sources: {
        Row: {
          id: string;
          name: string;
          slug: string;
          config: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          config?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          config?: Json;
          created_at?: string;
        };
      };
      raw_ingest: {
        Row: {
          id: string;
          source_id: string;
          entity_type: string;
          external_id: string;
          payload: Json;
          ingested_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          source_id: string;
          entity_type: string;
          external_id: string;
          payload?: Json;
          ingested_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          source_id?: string;
          entity_type?: string;
          external_id?: string;
          payload?: Json;
          ingested_at?: string;
          processed_at?: string | null;
        };
      };
      team_mapping: {
        Row: {
          id: string;
          source_id: string;
          external_team_id: string;
          team_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          external_team_id: string;
          team_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_id?: string;
          external_team_id?: string;
          team_id?: string;
          created_at?: string;
        };
      };
      entity_mapping: {
        Row: {
          id: string;
          source_id: string;
          entity_type: string;
          external_id: string;
          our_table: string;
          our_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          entity_type: string;
          external_id: string;
          our_table: string;
          our_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_id?: string;
          entity_type?: string;
          external_id?: string;
          our_table?: string;
          our_id?: string;
          created_at?: string;
        };
      };
      ingest_jobs: {
        Row: {
          id: string;
          job_type: string;
          status: string;
          scheduled_at: string;
          started_at: string | null;
          finished_at: string | null;
          result: Json | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_type: string;
          status?: string;
          scheduled_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
          result?: Json | null;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_type?: string;
          status?: string;
          scheduled_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
          result?: Json | null;
          error?: string | null;
          created_at?: string;
        };
      };
      match_disputes: {
        Row: {
          id: string;
          match_id: string;
          submitted_by: string;
          reason: string;
          status: string;
          created_at: string;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: {
          id?: string;
          match_id: string;
          submitted_by: string;
          reason: string;
          status?: string;
          created_at?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: {
          id?: string;
          match_id?: string;
          submitted_by?: string;
          reason?: string;
          status?: string;
          created_at?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
    };
  };
};
