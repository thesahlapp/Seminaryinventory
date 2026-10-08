export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          archived_at: string | null;
          created_at: string;
          default_has_sizes: boolean;
          description: string | null;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          default_has_sizes?: boolean;
          description?: string | null;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          default_has_sizes?: boolean;
          description?: string | null;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      item_photos: {
        Row: {
          alt_text: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          item_id: string;
          sort_order: number;
          storage_path: string;
          thumbnail_path: string | null;
        };
        ComputedFields: never;
        Insert: {
          alt_text?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          item_id: string;
          sort_order?: number;
          storage_path: string;
          thumbnail_path?: string | null;
        };
        Update: {
          alt_text?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          item_id?: string;
          sort_order?: number;
          storage_path?: string;
          thumbnail_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "item_photos_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_photos_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_levels";
            referencedColumns: ["item_id"];
          },
          {
            foreignKeyName: "item_photos_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      item_variants: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          item_id: string;
          size_id: string | null;
          sku: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          item_id: string;
          size_id?: string | null;
          sku?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          item_id?: string;
          size_id?: string | null;
          sku?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_variants_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_levels";
            referencedColumns: ["item_id"];
          },
          {
            foreignKeyName: "item_variants_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_variants_size_id_fkey";
            columns: ["size_id"];
            isOneToOne: false;
            referencedRelation: "inventory_levels";
            referencedColumns: ["size_id"];
          },
          {
            foreignKeyName: "item_variants_size_id_fkey";
            columns: ["size_id"];
            isOneToOne: false;
            referencedRelation: "sizes";
            referencedColumns: ["id"];
          },
        ];
      };
      items: {
        Row: {
          archived_at: string | null;
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          custom_fields: NonNullable<Json>;
          description: string | null;
          has_sizes: boolean;
          id: string;
          item_type: Database["public"]["Enums"]["item_type"];
          name: string;
          notes: string | null;
          sku: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          custom_fields?: NonNullable<Json>;
          description?: string | null;
          has_sizes?: boolean;
          id?: string;
          item_type?: Database["public"]["Enums"]["item_type"];
          name: string;
          notes?: string | null;
          sku?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          archived_at?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          custom_fields?: NonNullable<Json>;
          description?: string | null;
          has_sizes?: boolean;
          id?: string;
          item_type?: Database["public"]["Enums"]["item_type"];
          name?: string;
          notes?: string | null;
          sku?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "items_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      locations: {
        Row: {
          address: string | null;
          archived_at: string | null;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          archived_at?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          archived_at?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      sizes: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          is_standard: boolean;
          label: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          is_standard?: boolean;
          label: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          is_standard?: boolean;
          label?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_levels: {
        Row: {
          location_id: string;
          quantity: number;
          updated_at: string;
          variant_id: string;
        };
        ComputedFields: never;
        Insert: {
          location_id: string;
          quantity?: number;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          location_id?: string;
          quantity?: number;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_levels_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "location_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_levels_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_levels_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "item_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          changed_by_email: string | null;
          delta: number | null;
          id: number;
          location_id: string;
          new_quantity: number;
          old_quantity: number;
          reason: Database["public"]["Enums"]["stock_reason"];
          reason_note: string | null;
          reference_id: string | null;
          reference_type: string | null;
          transfer_group_id: string | null;
          variant_id: string;
        };
        ComputedFields: never;
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          changed_by_email?: string | null;
          delta?: never;
          id?: never;
          location_id: string;
          new_quantity: number;
          old_quantity: number;
          reason: Database["public"]["Enums"]["stock_reason"];
          reason_note?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          transfer_group_id?: string | null;
          variant_id: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          changed_by_email?: string | null;
          delta?: never;
          id?: never;
          location_id?: string;
          new_quantity?: number;
          old_quantity?: number;
          reason?: Database["public"]["Enums"]["stock_reason"];
          reason_note?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          transfer_group_id?: string | null;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "location_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "item_variants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      inventory_levels: {
        Row: {
          category_id: string | null;
          category_name: string | null;
          item_id: string | null;
          item_name: string | null;
          item_sku: string | null;
          location_id: string | null;
          location_name: string | null;
          quantity: number | null;
          size_id: string | null;
          size_label: string | null;
          size_sort_order: number | null;
          updated_at: string | null;
          variant_id: string | null;
          variant_sku: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_levels_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "location_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_levels_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_levels_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "item_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      location_summaries: {
        Row: {
          address: string | null;
          archived_at: string | null;
          description: string | null;
          id: string | null;
          item_count: number | null;
          name: string | null;
          sort_order: number | null;
          total_units: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      change_stock: {
        Args: {
          p_delta: number;
          p_location_id: string;
          p_note?: string;
          p_reason: Database["public"]["Enums"]["stock_reason"];
          p_variant_id: string;
        };
        Returns: {
          changed_at: string;
          changed_by: string | null;
          changed_by_email: string | null;
          delta: number | null;
          id: number;
          location_id: string;
          new_quantity: number;
          old_quantity: number;
          reason: Database["public"]["Enums"]["stock_reason"];
          reason_note: string | null;
          reference_id: string | null;
          reference_type: string | null;
          transfer_group_id: string | null;
          variant_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "stock_movements";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      inventory_items: {
        Args: {
          p_archived?: boolean;
          p_category_ids?: string[];
          p_descending?: boolean;
          p_limit?: number;
          p_location_ids?: string[];
          p_offset?: number;
          p_search?: string;
          p_sort?: string;
          p_uncategorized?: boolean;
        };
        Returns: {
          archived_at: string;
          category_id: string;
          category_name: string;
          has_sizes: boolean;
          id: string;
          last_updated: string;
          levels: Json;
          name: string;
          photo_path: string;
          sku: string;
          total_count: number;
          total_quantity: number;
          variants: Json;
        }[];
      };
      set_stock: {
        Args: {
          p_location_id: string;
          p_new_quantity: number;
          p_note?: string;
          p_reason: Database["public"]["Enums"]["stock_reason"];
          p_variant_id: string;
        };
        Returns: {
          changed_at: string;
          changed_by: string | null;
          changed_by_email: string | null;
          delta: number | null;
          id: number;
          location_id: string;
          new_quantity: number;
          old_quantity: number;
          reason: Database["public"]["Enums"]["stock_reason"];
          reason_note: string | null;
          reference_id: string | null;
          reference_type: string | null;
          transfer_group_id: string | null;
          variant_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "stock_movements";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      transfer_stock: {
        Args: {
          p_from_location_id: string;
          p_note?: string;
          p_quantity: number;
          p_to_location_id: string;
          p_variant_id: string;
        };
        Returns: {
          changed_at: string;
          changed_by: string | null;
          changed_by_email: string | null;
          delta: number | null;
          id: number;
          location_id: string;
          new_quantity: number;
          old_quantity: number;
          reason: Database["public"]["Enums"]["stock_reason"];
          reason_note: string | null;
          reference_id: string | null;
          reference_type: string | null;
          transfer_group_id: string | null;
          variant_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "stock_movements";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
    };
    Enums: {
      app_role: "admin" | "editor" | "viewer";
      item_type: "standard" | "kit";
      stock_reason:
        | "initial_count"
        | "received"
        | "issued"
        | "returned"
        | "count_correction"
        | "damaged"
        | "lost"
        | "transfer_in"
        | "transfer_out"
        | "other";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "editor", "viewer"],
      item_type: ["standard", "kit"],
      stock_reason: [
        "initial_count",
        "received",
        "issued",
        "returned",
        "count_correction",
        "damaged",
        "lost",
        "transfer_in",
        "transfer_out",
        "other",
      ],
    },
  },
} as const;
