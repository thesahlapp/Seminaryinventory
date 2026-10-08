export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_lines: {
        Row: {
          applied_new_quantity: number | null;
          applied_old_quantity: number | null;
          audit_id: string;
          counted_at: string | null;
          counted_by: string | null;
          counted_quantity: number | null;
          expected_quantity: number;
          id: string;
          variant_id: string;
        };
        ComputedFields: never;
        Insert: {
          applied_new_quantity?: number | null;
          applied_old_quantity?: number | null;
          audit_id: string;
          counted_at?: string | null;
          counted_by?: string | null;
          counted_quantity?: number | null;
          expected_quantity: number;
          id?: string;
          variant_id: string;
        };
        Update: {
          applied_new_quantity?: number | null;
          applied_old_quantity?: number | null;
          audit_id?: string;
          counted_at?: string | null;
          counted_by?: string | null;
          counted_quantity?: number | null;
          expected_quantity?: number;
          id?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_lines_audit_id_fkey";
            columns: ["audit_id"];
            isOneToOne: false;
            referencedRelation: "audits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_lines_counted_by_fkey";
            columns: ["counted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "item_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      audits: {
        Row: {
          completed_at: string | null;
          completed_by: string | null;
          id: string;
          location_id: string;
          notes: string | null;
          number: number;
          started_at: string;
          started_by: string | null;
          status: Database["public"]["Enums"]["audit_status"];
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          completed_by?: string | null;
          id?: string;
          location_id: string;
          notes?: string | null;
          number?: never;
          started_at?: string;
          started_by?: string | null;
          status?: Database["public"]["Enums"]["audit_status"];
        };
        Update: {
          completed_at?: string | null;
          completed_by?: string | null;
          id?: string;
          location_id?: string;
          notes?: string | null;
          number?: never;
          started_at?: string;
          started_by?: string | null;
          status?: Database["public"]["Enums"]["audit_status"];
        };
        Relationships: [
          {
            foreignKeyName: "audits_completed_by_fkey";
            columns: ["completed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audits_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "location_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audits_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audits_started_by_fkey";
            columns: ["started_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
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
      category_fields: {
        Row: {
          category_id: string;
          created_at: string;
          field_type: Database["public"]["Enums"]["field_type"];
          id: string;
          label: string;
          options: string[];
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          created_at?: string;
          field_type: Database["public"]["Enums"]["field_type"];
          id?: string;
          label: string;
          options?: string[];
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          field_type?: Database["public"]["Enums"]["field_type"];
          id?: string;
          label?: string;
          options?: string[];
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "category_fields_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      checkout_lines: {
        Row: {
          checkout_id: string;
          condition_note: string | null;
          id: string;
          location_id: string;
          missing: number;
          quantity: number;
          returned_at: string | null;
          returned_by: string | null;
          returned_damaged: number;
          returned_good: number;
          variant_id: string;
        };
        ComputedFields: never;
        Insert: {
          checkout_id: string;
          condition_note?: string | null;
          id?: string;
          location_id: string;
          missing?: number;
          quantity: number;
          returned_at?: string | null;
          returned_by?: string | null;
          returned_damaged?: number;
          returned_good?: number;
          variant_id: string;
        };
        Update: {
          checkout_id?: string;
          condition_note?: string | null;
          id?: string;
          location_id?: string;
          missing?: number;
          quantity?: number;
          returned_at?: string | null;
          returned_by?: string | null;
          returned_damaged?: number;
          returned_good?: number;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checkout_lines_checkout_id_fkey";
            columns: ["checkout_id"];
            isOneToOne: false;
            referencedRelation: "checkouts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checkout_lines_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "location_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checkout_lines_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checkout_lines_returned_by_fkey";
            columns: ["returned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checkout_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "item_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      checkouts: {
        Row: {
          borrower_id: string | null;
          borrower_name: string;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          due_date: string;
          id: string;
          kit_id: string | null;
          last_reminded_at: string | null;
          notes: string | null;
          number: number;
          project: string | null;
        };
        ComputedFields: never;
        Insert: {
          borrower_id?: string | null;
          borrower_name: string;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date: string;
          id?: string;
          kit_id?: string | null;
          last_reminded_at?: string | null;
          notes?: string | null;
          number?: never;
          project?: string | null;
        };
        Update: {
          borrower_id?: string | null;
          borrower_name?: string;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date?: string;
          id?: string;
          kit_id?: string | null;
          last_reminded_at?: string | null;
          notes?: string | null;
          number?: never;
          project?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "checkouts_borrower_id_fkey";
            columns: ["borrower_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checkouts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checkouts_kit_id_fkey";
            columns: ["kit_id"];
            isOneToOne: false;
            referencedRelation: "kits";
            referencedColumns: ["id"];
          },
        ];
      };
      item_comments: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          edited_at: string | null;
          id: string;
          item_id: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          item_id: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_comments_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_levels";
            referencedColumns: ["item_id"];
          },
          {
            foreignKeyName: "item_comments_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      item_costs: {
        Row: {
          item_id: string;
          retail_price: number | null;
          unit_cost: number | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          item_id: string;
          retail_price?: number | null;
          unit_cost?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          item_id?: string;
          retail_price?: number | null;
          unit_cost?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "item_costs_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: true;
            referencedRelation: "inventory_levels";
            referencedColumns: ["item_id"];
          },
          {
            foreignKeyName: "item_costs_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: true;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_costs_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      item_photos: {
        Row: {
          alt_text: string | null;
          caption: string | null;
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
          caption?: string | null;
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
          caption?: string | null;
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
          min_quantity: number | null;
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
          min_quantity?: number | null;
          size_id?: string | null;
          sku?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          item_id?: string;
          min_quantity?: number | null;
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
          checkoutable: boolean;
          created_at: string;
          created_by: string | null;
          custom_fields: NonNullable<Json>;
          description: string | null;
          has_sizes: boolean;
          id: string;
          item_type: Database["public"]["Enums"]["item_type"];
          min_quantity: number | null;
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
          checkoutable?: boolean;
          created_at?: string;
          created_by?: string | null;
          custom_fields?: NonNullable<Json>;
          description?: string | null;
          has_sizes?: boolean;
          id?: string;
          item_type?: Database["public"]["Enums"]["item_type"];
          min_quantity?: number | null;
          name: string;
          notes?: string | null;
          sku?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          archived_at?: string | null;
          category_id?: string | null;
          checkoutable?: boolean;
          created_at?: string;
          created_by?: string | null;
          custom_fields?: NonNullable<Json>;
          description?: string | null;
          has_sizes?: boolean;
          id?: string;
          item_type?: Database["public"]["Enums"]["item_type"];
          min_quantity?: number | null;
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
      kit_items: {
        Row: {
          kit_id: string;
          quantity: number;
          variant_id: string;
        };
        ComputedFields: never;
        Insert: {
          kit_id: string;
          quantity: number;
          variant_id: string;
        };
        Update: {
          kit_id?: string;
          quantity?: number;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kit_items_kit_id_fkey";
            columns: ["kit_id"];
            isOneToOne: false;
            referencedRelation: "kits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "kit_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "item_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      kits: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          name: string;
          photo_path: string | null;
          thumbnail_path: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          photo_path?: string | null;
          thumbnail_path?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          photo_path?: string | null;
          thumbnail_path?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kits_created_by_fkey";
            columns: ["created_by"];
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
      notifications: {
        Row: {
          actor_id: string | null;
          comment_id: string | null;
          created_at: string;
          emailed_at: string | null;
          id: string;
          item_id: string | null;
          kind: string;
          read_at: string | null;
          recipient_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          emailed_at?: string | null;
          id?: string;
          item_id?: string | null;
          kind: string;
          read_at?: string | null;
          recipient_id: string;
        };
        Update: {
          actor_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          emailed_at?: string | null;
          id?: string;
          item_id?: string | null;
          kind?: string;
          read_at?: string | null;
          recipient_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "item_comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_levels";
            referencedColumns: ["item_id"];
          },
          {
            foreignKeyName: "notifications_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          email_low_stock: boolean;
          email_mentions: boolean;
          email_overdue: boolean;
          full_name: string | null;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          theme: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email?: string | null;
          email_low_stock?: boolean;
          email_mentions?: boolean;
          email_overdue?: boolean;
          full_name?: string | null;
          id: string;
          role?: Database["public"]["Enums"]["app_role"];
          theme?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          email_low_stock?: boolean;
          email_mentions?: boolean;
          email_overdue?: boolean;
          full_name?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          theme?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_order_lines: {
        Row: {
          id: string;
          purchase_order_id: string;
          quantity_ordered: number;
          quantity_received: number;
          unit_cost: number | null;
          variant_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          purchase_order_id: string;
          quantity_ordered: number;
          quantity_received?: number;
          unit_cost?: number | null;
          variant_id: string;
        };
        Update: {
          id?: string;
          purchase_order_id?: string;
          quantity_ordered?: number;
          quantity_received?: number;
          unit_cost?: number | null;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "item_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_orders: {
        Row: {
          created_at: string;
          created_by: string | null;
          destination_location_id: string;
          expected_date: string | null;
          id: string;
          notes: string | null;
          number: number;
          ordered_at: string | null;
          received_at: string | null;
          status: Database["public"]["Enums"]["po_status"];
          supplier_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          destination_location_id: string;
          expected_date?: string | null;
          id?: string;
          notes?: string | null;
          number?: never;
          ordered_at?: string | null;
          received_at?: string | null;
          status?: Database["public"]["Enums"]["po_status"];
          supplier_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          destination_location_id?: string;
          expected_date?: string | null;
          id?: string;
          notes?: string | null;
          number?: never;
          ordered_at?: string | null;
          received_at?: string | null;
          status?: Database["public"]["Enums"]["po_status"];
          supplier_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "location_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
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
      suppliers: {
        Row: {
          archived_at: string | null;
          contact_name: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          updated_at: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          contact_name?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          archived_at?: string | null;
          contact_name?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      checked_out_quantities: {
        Row: {
          quantity: number | null;
          variant_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "checkout_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "item_variants";
            referencedColumns: ["id"];
          },
        ];
      };
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
      low_stock: {
        Row: {
          item_id: string | null;
          item_name: string | null;
          min_quantity: number | null;
          on_hand: number | null;
          shortfall: number | null;
          size_label: string | null;
          variant_id: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      apply_audit: {
        Args: { p_audit_id: string };
        Returns: {
          completed_at: string | null;
          completed_by: string | null;
          id: string;
          location_id: string;
          notes: string | null;
          number: number;
          started_at: string;
          started_by: string | null;
          status: Database["public"]["Enums"]["audit_status"];
        };
        SetofOptions: {
          from: "*";
          to: "audits";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cancel_audit: {
        Args: { p_audit_id: string };
        Returns: {
          completed_at: string | null;
          completed_by: string | null;
          id: string;
          location_id: string;
          notes: string | null;
          number: number;
          started_at: string;
          started_by: string | null;
          status: Database["public"]["Enums"]["audit_status"];
        };
        SetofOptions: {
          from: "*";
          to: "audits";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
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
      checkin_items: {
        Args: { p_checkout_id: string; p_lines: Json };
        Returns: {
          borrower_id: string | null;
          borrower_name: string;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          due_date: string;
          id: string;
          kit_id: string | null;
          last_reminded_at: string | null;
          notes: string | null;
          number: number;
          project: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "checkouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      checkout_items: {
        Args: {
          p_borrower_id?: string;
          p_borrower_name: string;
          p_due_date: string;
          p_lines: Json;
          p_notes?: string;
          p_project?: string;
        };
        Returns: {
          borrower_id: string | null;
          borrower_name: string;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          due_date: string;
          id: string;
          kit_id: string | null;
          last_reminded_at: string | null;
          notes: string | null;
          number: number;
          project: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "checkouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      checkout_kit: {
        Args: {
          p_borrower_id?: string;
          p_borrower_name: string;
          p_due_date: string;
          p_kit_id: string;
          p_notes?: string;
          p_project?: string;
        };
        Returns: {
          borrower_id: string | null;
          borrower_name: string;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          due_date: string;
          id: string;
          kit_id: string | null;
          last_reminded_at: string | null;
          notes: string | null;
          number: number;
          project: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "checkouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      dashboard_summary: { Args: Record<PropertyKey, never>; Returns: Json };
      inventory_items: {
        Args: {
          p_archived?: boolean;
          p_category_ids?: string[];
          p_checkoutable?: boolean;
          p_descending?: boolean;
          p_field_filters?: Json;
          p_limit?: number;
          p_location_ids?: string[];
          p_low_stock?: boolean;
          p_offset?: number;
          p_search?: string;
          p_sort?: string;
          p_uncategorized?: boolean;
        };
        Returns: {
          archived_at: string;
          category_id: string;
          category_name: string;
          checked_out: number;
          checkoutable: boolean;
          custom_fields: Json;
          has_sizes: boolean;
          id: string;
          last_updated: string;
          levels: Json;
          low_stock: boolean;
          name: string;
          photo_path: string;
          sku: string;
          total_count: number;
          total_quantity: number;
          variants: Json;
        }[];
      };
      inventory_value: { Args: Record<PropertyKey, never>; Returns: Json };
      receive_purchase_order: {
        Args: {
          p_lines: Json;
          p_location_id?: string;
          p_purchase_order_id: string;
          p_update_costs?: boolean;
        };
        Returns: {
          created_at: string;
          created_by: string | null;
          destination_location_id: string;
          expected_date: string | null;
          id: string;
          notes: string | null;
          number: number;
          ordered_at: string | null;
          received_at: string | null;
          status: Database["public"]["Enums"]["po_status"];
          supplier_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "purchase_orders";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_audit_count: {
        Args: { p_audit_id: string; p_counted: number; p_variant_id: string };
        Returns: {
          applied_new_quantity: number | null;
          applied_old_quantity: number | null;
          audit_id: string;
          counted_at: string | null;
          counted_by: string | null;
          counted_quantity: number | null;
          expected_quantity: number;
          id: string;
          variant_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "audit_lines";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      report_checkouts: { Args: { p_from: string; p_to: string }; Returns: Json };
      report_losses: {
        Args: { p_from: string; p_to: string };
        Returns: {
          item_id: string;
          item_name: string;
          kind: string;
          size_label: string;
          units: number;
          value: number;
        }[];
      };
      report_movers: {
        Args: { p_from: string; p_to: string };
        Returns: {
          category_name: string;
          item_id: string;
          item_name: string;
          movements: number;
          on_hand: number;
          units_out: number;
        }[];
      };
      report_usage: {
        Args: { p_bucket?: string; p_from: string; p_group?: string; p_to: string };
        Returns: {
          bucket: string;
          group_id: string;
          group_name: string;
          units_in: number;
          units_out: number;
        }[];
      };
      report_value_over_time: {
        Args: { p_from: string; p_to: string };
        Returns: {
          day: string;
          units: number;
          value: number;
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
      start_audit: {
        Args: { p_location_id: string; p_notes?: string };
        Returns: {
          completed_at: string | null;
          completed_by: string | null;
          id: string;
          location_id: string;
          notes: string | null;
          number: number;
          started_at: string;
          started_by: string | null;
          status: Database["public"]["Enums"]["audit_status"];
        };
        SetofOptions: {
          from: "*";
          to: "audits";
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
      audit_status: "in_progress" | "completed" | "cancelled";
      field_type: "text" | "number" | "date" | "select" | "boolean";
      item_type: "standard" | "kit";
      po_status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
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
        | "other"
        | "checked_out"
        | "checked_in"
        | "audit_correction";
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
      audit_status: ["in_progress", "completed", "cancelled"],
      field_type: ["text", "number", "date", "select", "boolean"],
      item_type: ["standard", "kit"],
      po_status: ["draft", "ordered", "partially_received", "received", "cancelled"],
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
        "checked_out",
        "checked_in",
        "audit_correction",
      ],
    },
  },
} as const;
