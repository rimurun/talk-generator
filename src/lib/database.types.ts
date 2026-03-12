// Supabase Database 型定義（db-schema.sql に対応）

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          channel_name: string;
          specialties: string[];
          ng_words: string[];
          daily_limit: number;
          preferred_tone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          channel_name?: string;
          specialties?: string[];
          ng_words?: string[];
          daily_limit?: number;
          preferred_tone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          channel_name?: string;
          specialties?: string[];
          ng_words?: string[];
          daily_limit?: number;
          preferred_tone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      generated_cache: {
        Row: {
          id: string;
          cache_type: string;
          cache_key: string;
          data: Record<string, unknown>;
          created_at: string;
          expires_at: string;
          access_count: number;
        };
        Insert: {
          id?: string;
          cache_type: string;
          cache_key: string;
          data: Record<string, unknown>;
          created_at?: string;
          expires_at: string;
          access_count?: number;
        };
        Update: {
          cache_type?: string;
          cache_key?: string;
          data?: Record<string, unknown>;
          expires_at?: string;
          access_count?: number;
        };
        Relationships: [];
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          topic_id: string;
          script_id: string | null;
          title: string;
          category: string | null;
          notes: string | null;
          added_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          topic_id: string;
          script_id?: string | null;
          title: string;
          category?: string | null;
          notes?: string | null;
          added_at?: string;
        };
        Update: {
          type?: string;
          topic_id?: string;
          script_id?: string | null;
          title?: string;
          category?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      generation_history: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          timestamp: string;
          filters: Record<string, unknown> | null;
          topic_id: string | null;
          script_settings: Record<string, unknown> | null;
          cost: number;
          cached: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          timestamp?: string;
          filters?: Record<string, unknown> | null;
          topic_id?: string | null;
          script_settings?: Record<string, unknown> | null;
          cost?: number;
          cached?: boolean;
        };
        Update: {
          type?: string;
          filters?: Record<string, unknown> | null;
          topic_id?: string | null;
          script_settings?: Record<string, unknown> | null;
          cost?: number;
          cached?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "generation_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      script_ratings: {
        Row: {
          id: string;
          user_id: string;
          script_id: string;
          topic_id: string;
          rating: number;
          comment: string | null;
          rated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          script_id: string;
          topic_id: string;
          rating: number;
          comment?: string | null;
          rated_at?: string;
        };
        Update: {
          script_id?: string;
          topic_id?: string;
          rating?: number;
          comment?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "script_ratings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
