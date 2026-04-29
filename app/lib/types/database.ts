export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_models: {
        Row: {
          cost_per_1k_input: number | null
          cost_per_1k_output: number | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          model_id: string
          provider: string
          use_case: string
        }
        Insert: {
          cost_per_1k_input?: number | null
          cost_per_1k_output?: number | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          model_id: string
          provider: string
          use_case: string
        }
        Update: {
          cost_per_1k_input?: number | null
          cost_per_1k_output?: number | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          model_id?: string
          provider?: string
          use_case?: string
        }
        Relationships: []
      }
      api_logs: {
        Row: {
          cost_usd: number | null
          created_at: string
          endpoint: string
          error_message: string | null
          http_status: number | null
          id: string
          latency_ms: number | null
          method: string
          service: string
          status: string
          user_id: string | null
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          method: string
          service: string
          status: string
          user_id?: string | null
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          method?: string
          service?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "api_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assignments: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          is_primary: boolean
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_assignments_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_assignments_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "mv_top_brands_30d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "brand_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "brand_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          aliases: string[] | null
          created_at: string
          id: string
          is_active: boolean
          markup_percent: number
          name: string
          notes: string | null
          region: Database["public"]["Enums"]["region_code"] | null
          updated_at: string
        }
        Insert: {
          aliases?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          markup_percent?: number
          name: string
          notes?: string | null
          region?: Database["public"]["Enums"]["region_code"] | null
          updated_at?: string
        }
        Update: {
          aliases?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          markup_percent?: number
          name?: string
          notes?: string | null
          region?: Database["public"]["Enums"]["region_code"] | null
          updated_at?: string
        }
        Relationships: []
      }
      carriers: {
        Row: {
          api_endpoint: string | null
          config: Json | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          name: string
          region: Database["public"]["Enums"]["region_code"] | null
        }
        Insert: {
          api_endpoint?: string | null
          config?: Json | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          name: string
          region?: Database["public"]["Enums"]["region_code"] | null
        }
        Update: {
          api_endpoint?: string | null
          config?: Json | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          name?: string
          region?: Database["public"]["Enums"]["region_code"] | null
        }
        Relationships: []
      }
      correction_rules: {
        Row: {
          applies_to: Json
          created_at: string
          created_by: string
          description: string | null
          field_name: string
          id: string
          is_active: boolean
          name: string
          operation: string
          value: number
        }
        Insert: {
          applies_to: Json
          created_at?: string
          created_by: string
          description?: string | null
          field_name: string
          id?: string
          is_active?: boolean
          name: string
          operation: string
          value: number
        }
        Update: {
          applies_to?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          field_name?: string
          id?: string
          is_active?: boolean
          name?: string
          operation?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "correction_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "correction_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoices: {
        Row: {
          ai_confidence: Database["public"]["Enums"]["ai_confidence"] | null
          ai_model_used: string | null
          ai_reasoning: Json | null
          cost: number
          cost_currency: Database["public"]["Enums"]["currency_code"]
          created_at: string
          generated_at: string | null
          generated_by: string | null
          id: string
          invoice_number: string
          item_price: number
          language: Database["public"]["Enums"]["invoice_language"]
          markup_percent: number
          order_id: string
          pdf_storage_path: string | null
          profit_amount: number | null
          profit_percent: number | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sent_at: string | null
          sent_to_email: string | null
          shipment_fee: number
          status: Database["public"]["Enums"]["invoice_status"]
          supplier_invoice_id: string | null
          tax_amount: number
          tax_percent: number
          template_id: string | null
          total: number
          total_currency: Database["public"]["Enums"]["currency_code"]
          updated_at: string
          whatsapp_sent_at: string | null
        }
        Insert: {
          ai_confidence?: Database["public"]["Enums"]["ai_confidence"] | null
          ai_model_used?: string | null
          ai_reasoning?: Json | null
          cost: number
          cost_currency: Database["public"]["Enums"]["currency_code"]
          created_at?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          invoice_number: string
          item_price: number
          language: Database["public"]["Enums"]["invoice_language"]
          markup_percent: number
          order_id: string
          pdf_storage_path?: string | null
          profit_amount?: number | null
          profit_percent?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          shipment_fee?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          supplier_invoice_id?: string | null
          tax_amount?: number
          tax_percent?: number
          template_id?: string | null
          total: number
          total_currency: Database["public"]["Enums"]["currency_code"]
          updated_at?: string
          whatsapp_sent_at?: string | null
        }
        Update: {
          ai_confidence?: Database["public"]["Enums"]["ai_confidence"] | null
          ai_model_used?: string | null
          ai_reasoning?: Json | null
          cost?: number
          cost_currency?: Database["public"]["Enums"]["currency_code"]
          created_at?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          invoice_number?: string
          item_price?: number
          language?: Database["public"]["Enums"]["invoice_language"]
          markup_percent?: number
          order_id?: string
          pdf_storage_path?: string | null
          profit_amount?: number | null
          profit_percent?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          shipment_fee?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          supplier_invoice_id?: string | null
          tax_amount?: number
          tax_percent?: number
          template_id?: string | null
          total?: number
          total_currency?: Database["public"]["Enums"]["currency_code"]
          updated_at?: string
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoices_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "customer_invoices_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_employee"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "customer_invoices_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_invoices_employee"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          default_address: Json | null
          email: string | null
          first_name: string | null
          id: string
          language_pref: string | null
          last_name: string | null
          phone: string | null
          shopify_customer_id: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_address?: Json | null
          email?: string | null
          first_name?: string | null
          id?: string
          language_pref?: string | null
          last_name?: string | null
          phone?: string | null
          shopify_customer_id?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_address?: Json | null
          email?: string | null
          first_name?: string | null
          id?: string
          language_pref?: string | null
          last_name?: string | null
          phone?: string | null
          shopify_customer_id?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      hourly_rates: {
        Row: {
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          effective_from: string
          id: string
          notes: string | null
          set_by: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          effective_from: string
          id?: string
          notes?: string | null
          set_by?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          effective_from?: string
          id?: string
          notes?: string | null
          set_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hourly_rates_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "hourly_rates_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_rates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "hourly_rates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string
          region: Database["public"]["Enums"]["region_code"] | null
          roles: Database["public"]["Enums"]["user_role"][]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name: string
          id?: string
          invited_by: string
          region?: Database["public"]["Enums"]["region_code"] | null
          roles: Database["public"]["Enums"]["user_role"][]
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string
          region?: Database["public"]["Enums"]["region_code"] | null
          roles?: Database["public"]["Enums"]["user_role"][]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_corrections: {
        Row: {
          corrected_by: string
          corrected_value: string
          created_at: string
          customer_invoice_id: string
          field_name: string
          id: string
          original_value: string | null
          reason: string | null
        }
        Insert: {
          corrected_by: string
          corrected_value: string
          created_at?: string
          customer_invoice_id: string
          field_name: string
          id?: string
          original_value?: string | null
          reason?: string | null
        }
        Update: {
          corrected_by?: string
          corrected_value?: string
          created_at?: string
          customer_invoice_id?: string
          field_name?: string
          id?: string
          original_value?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "invoice_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_corrections_customer_invoice_id_fkey"
            columns: ["customer_invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          last_used_number: number
          year: number
        }
        Insert: {
          last_used_number?: number
          year: number
        }
        Update: {
          last_used_number?: number
          year?: number
        }
        Relationships: []
      }
      invoice_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          language: Database["public"]["Enums"]["invoice_language"]
          name: string
          preview_url: string | null
          storage_path: string
          updated_at: string
          uploaded_by: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          language: Database["public"]["Enums"]["invoice_language"]
          name: string
          preview_url?: string | null
          storage_path: string
          updated_at?: string
          uploaded_by: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          language?: Database["public"]["Enums"]["invoice_language"]
          name?: string
          preview_url?: string | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_templates_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "invoice_templates_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          description: string | null
          href: string | null
          id: string
          metadata: Json | null
          read_at: string | null
          resource_id: string | null
          resource_type: string | null
          severity: Database["public"]["Enums"]["notification_severity"]
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          href?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity: Database["public"]["Enums"]["notification_severity"]
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          href?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: Database["public"]["Enums"]["notification_severity"]
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_archive: {
        Row: {
          created_at: string
          description: string | null
          href: string | null
          id: string
          metadata: Json | null
          read_at: string | null
          resource_id: string | null
          resource_type: string | null
          severity: Database["public"]["Enums"]["notification_severity"]
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          href?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity: Database["public"]["Enums"]["notification_severity"]
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          href?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: Database["public"]["Enums"]["notification_severity"]
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      ocr_corrections: {
        Row: {
          corrected_by: string
          corrected_value: string
          created_at: string
          field_name: string
          id: string
          original_value: string | null
          supplier_invoice_item_id: string
        }
        Insert: {
          corrected_by: string
          corrected_value: string
          created_at?: string
          field_name: string
          id?: string
          original_value?: string | null
          supplier_invoice_item_id: string
        }
        Update: {
          corrected_by?: string
          corrected_value?: string
          created_at?: string
          field_name?: string
          id?: string
          original_value?: string | null
          supplier_invoice_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "ocr_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_corrections_supplier_invoice_item_id_fkey"
            columns: ["supplier_invoice_item_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_corrections_supplier_invoice_item_id_fkey"
            columns: ["supplier_invoice_item_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_invoice_items_employee"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          currency: Database["public"]["Enums"]["currency_code"]
          customer_id: string | null
          id: string
          ingested_at: string
          notes: string | null
          raw_payload: Json
          shipping_address: Json | null
          shopify_created_at: string
          shopify_order_id: string
          shopify_order_number: string
          store_id: string
          subtotal: number | null
          total: number | null
          updated_at: string
        }
        Insert: {
          billing_address?: Json | null
          currency: Database["public"]["Enums"]["currency_code"]
          customer_id?: string | null
          id?: string
          ingested_at?: string
          notes?: string | null
          raw_payload: Json
          shipping_address?: Json | null
          shopify_created_at: string
          shopify_order_id: string
          shopify_order_number: string
          store_id: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          billing_address?: Json | null
          currency?: Database["public"]["Enums"]["currency_code"]
          customer_id?: string | null
          id?: string
          ingested_at?: string
          notes?: string | null
          raw_payload?: Json
          shipping_address?: Json | null
          shopify_created_at?: string
          shopify_order_id?: string
          shopify_order_number?: string
          store_id?: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean
          joined_at: string | null
          last_seen_at: string | null
          preferences: Json | null
          region: Database["public"]["Enums"]["region_code"] | null
          ship_from_address: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string | null
          last_seen_at?: string | null
          preferences?: Json | null
          region?: Database["public"]["Enums"]["region_code"] | null
          ship_from_address?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string | null
          last_seen_at?: string | null
          preferences?: Json | null
          region?: Database["public"]["Enums"]["region_code"] | null
          ship_from_address?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          created_at: string
          display_order: number
          filters: Json
          id: string
          is_shared: boolean
          name: string
          page: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          filters?: Json
          id?: string
          is_shared?: boolean
          name: string
          page: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          filters?: Json
          id?: string
          is_shared?: boolean
          name?: string
          page?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_sub_orders: {
        Row: {
          shipment_id: string
          sub_order_id: string
        }
        Insert: {
          shipment_id: string
          sub_order_id: string
        }
        Update: {
          shipment_id?: string
          sub_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_sub_orders_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_sub_orders_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_sub_orders_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "v_sub_orders_employee"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          destination: string | null
          id: string
          label_storage_path: string | null
          origin: string | null
          shipment_type: string
          shipped_at: string | null
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          carrier_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          destination?: string | null
          id?: string
          label_storage_path?: string | null
          origin?: string | null
          shipment_type: string
          shipped_at?: string | null
          status: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          carrier_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          destination?: string | null
          id?: string
          label_storage_path?: string | null
          origin?: string | null
          shipment_type?: string
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "shipments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          metadata: Json | null
          notes: string | null
          sub_order_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          sub_order_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          sub_order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_history_from_status_fkey"
            columns: ["from_status"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "status_history_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_history_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "v_sub_orders_employee"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_history_to_status_fkey"
            columns: ["to_status"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["key"]
          },
        ]
      }
      statuses: {
        Row: {
          allowed_from_roles: Database["public"]["Enums"]["user_role"][]
          category: string
          color_class: string
          created_at: string
          display_order: number
          is_terminal: boolean
          key: string
          label_ar: string
          label_en: string
          notifies_customer: boolean
          twilio_template_sid: string | null
        }
        Insert: {
          allowed_from_roles: Database["public"]["Enums"]["user_role"][]
          category: string
          color_class: string
          created_at?: string
          display_order: number
          is_terminal?: boolean
          key: string
          label_ar: string
          label_en: string
          notifies_customer?: boolean
          twilio_template_sid?: string | null
        }
        Update: {
          allowed_from_roles?: Database["public"]["Enums"]["user_role"][]
          category?: string
          color_class?: string
          created_at?: string
          display_order?: number
          is_terminal?: boolean
          key?: string
          label_ar?: string
          label_en?: string
          notifies_customer?: boolean
          twilio_template_sid?: string | null
        }
        Relationships: []
      }
      stores: {
        Row: {
          created_at: string
          default_currency: Database["public"]["Enums"]["currency_code"]
          id: string
          is_active: boolean
          name: string
          region: Database["public"]["Enums"]["region_code"] | null
          shopify_admin_token: string | null
          shopify_domain: string
          shopify_webhook_secret: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          is_active?: boolean
          name: string
          region?: Database["public"]["Enums"]["region_code"] | null
          shopify_admin_token?: string | null
          shopify_domain: string
          shopify_webhook_secret?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          is_active?: boolean
          name?: string
          region?: Database["public"]["Enums"]["region_code"] | null
          shopify_admin_token?: string | null
          shopify_domain?: string
          shopify_webhook_secret?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sub_order_supplier_invoices: {
        Row: {
          linked_at: string
          linked_by: string
          sub_order_id: string
          supplier_invoice_id: string
        }
        Insert: {
          linked_at?: string
          linked_by: string
          sub_order_id: string
          supplier_invoice_id: string
        }
        Update: {
          linked_at?: string
          linked_by?: string
          sub_order_id?: string
          supplier_invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_order_supplier_invoices_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "sub_order_supplier_invoices_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_order_supplier_invoices_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_order_supplier_invoices_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "v_sub_orders_employee"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_order_supplier_invoices_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_order_supplier_invoices_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_invoices_employee"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_orders: {
        Row: {
          assigned_employee_id: string | null
          brand_id: string | null
          brand_name_raw: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          is_at_risk: boolean
          is_delayed: boolean
          is_unassigned: boolean
          order_id: string
          product_image_url: string | null
          product_title: string
          quantity: number
          shopify_line_item_id: string | null
          sku: string | null
          sla_due_at: string | null
          status: string
          status_changed_at: string
          status_changed_by: string | null
          sub_order_number: string
          unit_price: number | null
          updated_at: string
          variant_title: string | null
        }
        Insert: {
          assigned_employee_id?: string | null
          brand_id?: string | null
          brand_name_raw?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          id?: string
          is_at_risk?: boolean
          is_delayed?: boolean
          is_unassigned?: boolean
          order_id: string
          product_image_url?: string | null
          product_title: string
          quantity?: number
          shopify_line_item_id?: string | null
          sku?: string | null
          sla_due_at?: string | null
          status: string
          status_changed_at?: string
          status_changed_by?: string | null
          sub_order_number: string
          unit_price?: number | null
          updated_at?: string
          variant_title?: string | null
        }
        Update: {
          assigned_employee_id?: string | null
          brand_id?: string | null
          brand_name_raw?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          is_at_risk?: boolean
          is_delayed?: boolean
          is_unassigned?: boolean
          order_id?: string
          product_image_url?: string | null
          product_title?: string
          quantity?: number
          shopify_line_item_id?: string | null
          sku?: string | null
          sla_due_at?: string | null
          status?: string
          status_changed_at?: string
          status_changed_by?: string | null
          sub_order_number?: string
          unit_price?: number | null
          updated_at?: string
          variant_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sub_orders_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "sub_orders_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "mv_top_brands_30d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "sub_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_employee"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_status_changed_by_fkey"
            columns: ["status_changed_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "sub_orders_status_changed_by_fkey"
            columns: ["status_changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["key"]
          },
        ]
      }
      supplier_invoice_items: {
        Row: {
          ai_confidence: Database["public"]["Enums"]["ai_confidence"] | null
          ai_match_score: number | null
          ai_reasoning: string | null
          barcode: string | null
          created_at: string
          description: string | null
          id: string
          line_total: number | null
          mapped_at: string | null
          mapped_by: string | null
          mapped_sub_order_id: string | null
          quantity: number | null
          supplier_invoice_id: string
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          ai_confidence?: Database["public"]["Enums"]["ai_confidence"] | null
          ai_match_score?: number | null
          ai_reasoning?: string | null
          barcode?: string | null
          created_at?: string
          description?: string | null
          id?: string
          line_total?: number | null
          mapped_at?: string | null
          mapped_by?: string | null
          mapped_sub_order_id?: string | null
          quantity?: number | null
          supplier_invoice_id: string
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          ai_confidence?: Database["public"]["Enums"]["ai_confidence"] | null
          ai_match_score?: number | null
          ai_reasoning?: string | null
          barcode?: string | null
          created_at?: string
          description?: string | null
          id?: string
          line_total?: number | null
          mapped_at?: string | null
          mapped_by?: string | null
          mapped_sub_order_id?: string | null
          quantity?: number | null
          supplier_invoice_id?: string
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoice_items_mapped_by_fkey"
            columns: ["mapped_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "supplier_invoice_items_mapped_by_fkey"
            columns: ["mapped_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_items_mapped_sub_order_id_fkey"
            columns: ["mapped_sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_items_mapped_sub_order_id_fkey"
            columns: ["mapped_sub_order_id"]
            isOneToOne: false
            referencedRelation: "v_sub_orders_employee"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_items_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_items_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_invoices_employee"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          barcode: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"] | null
          file_size_bytes: number | null
          id: string
          invoice_date: string | null
          invoice_total: number | null
          mime_type: string | null
          notes: string | null
          ocr_extracted_at: string | null
          ocr_model_used: string | null
          ocr_raw_response: Json | null
          ocr_state: Database["public"]["Enums"]["ocr_state"]
          original_filename: string | null
          source: string
          storage_path: string
          supplier_name: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          file_size_bytes?: number | null
          id?: string
          invoice_date?: string | null
          invoice_total?: number | null
          mime_type?: string | null
          notes?: string | null
          ocr_extracted_at?: string | null
          ocr_model_used?: string | null
          ocr_raw_response?: Json | null
          ocr_state?: Database["public"]["Enums"]["ocr_state"]
          original_filename?: string | null
          source?: string
          storage_path: string
          supplier_name?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"] | null
          file_size_bytes?: number | null
          id?: string
          invoice_date?: string | null
          invoice_total?: number | null
          mime_type?: string | null
          notes?: string | null
          ocr_extracted_at?: string | null
          ocr_model_used?: string | null
          ocr_raw_response?: Json | null
          ocr_state?: Database["public"]["Enums"]["ocr_state"]
          original_filename?: string | null
          source?: string
          storage_path?: string
          supplier_name?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "supplier_invoices_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          duration_seconds: number
          ended_at: string | null
          hubstaff_entry_id: string | null
          id: string
          notes: string | null
          pulled_at: string
          raw_payload: Json | null
          source: string
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds: number
          ended_at?: string | null
          hubstaff_entry_id?: string | null
          id?: string
          notes?: string | null
          pulled_at?: string
          raw_payload?: Json | null
          source?: string
          started_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          hubstaff_entry_id?: string | null
          id?: string
          notes?: string | null
          pulled_at?: string
          raw_payload?: Json | null
          source?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          received_at: string
          source: string
          topic: string | null
          webhook_id: string
        }
        Insert: {
          received_at?: string
          source: string
          topic?: string | null
          webhook_id: string
        }
        Update: {
          received_at?: string
          source?: string
          topic?: string | null
          webhook_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      mv_dashboard_kpis: {
        Row: {
          active_count: number | null
          at_risk_count: number | null
          completed_30d: number | null
          delayed_count: number | null
          on_time_pct: number | null
          total_orders_30d: number | null
        }
        Relationships: []
      }
      mv_revenue_by_currency: {
        Row: {
          currency: Database["public"]["Enums"]["currency_code"] | null
          order_count_30d: number | null
          prev_order_count: number | null
          prev_total: number | null
          total_30d: number | null
        }
        Relationships: []
      }
      mv_team_load: {
        Row: {
          active_items: number | null
          load_percent: number | null
          member_count: number | null
          team: string | null
        }
        Relationships: []
      }
      mv_team_performance_30d: {
        Row: {
          employee_id: string | null
          full_name: string | null
          items_completed_30d: number | null
          on_time_pct: number | null
          region: Database["public"]["Enums"]["region_code"] | null
          role: string | null
        }
        Relationships: []
      }
      mv_top_brands_30d: {
        Row: {
          brand_id: string | null
          brand_name: string | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          items_count: number | null
          revenue: number | null
        }
        Relationships: []
      }
      v_orders_employee: {
        Row: {
          billing_address: Json | null
          customer_id: string | null
          id: string | null
          ingested_at: string | null
          notes: string | null
          shipping_address: Json | null
          shopify_created_at: string | null
          shopify_order_id: string | null
          shopify_order_number: string | null
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          billing_address?: Json | null
          customer_id?: string | null
          id?: string | null
          ingested_at?: string | null
          notes?: string | null
          shipping_address?: Json | null
          shopify_created_at?: string | null
          shopify_order_id?: string | null
          shopify_order_number?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_address?: Json | null
          customer_id?: string | null
          id?: string | null
          ingested_at?: string | null
          notes?: string | null
          shipping_address?: Json | null
          shopify_created_at?: string | null
          shopify_order_id?: string | null
          shopify_order_number?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      v_settings_employee: {
        Row: {
          description: string | null
          key: string | null
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          description?: string | null
          key?: string | null
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          description?: string | null
          key?: string | null
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      v_sub_orders_employee: {
        Row: {
          assigned_employee_id: string | null
          brand_id: string | null
          brand_name_raw: string | null
          created_at: string | null
          id: string | null
          is_at_risk: boolean | null
          is_delayed: boolean | null
          is_unassigned: boolean | null
          order_id: string | null
          product_image_url: string | null
          product_title: string | null
          quantity: number | null
          shopify_line_item_id: string | null
          sku: string | null
          sla_due_at: string | null
          status: string | null
          status_changed_at: string | null
          status_changed_by: string | null
          sub_order_number: string | null
          updated_at: string | null
          variant_title: string | null
        }
        Insert: {
          assigned_employee_id?: string | null
          brand_id?: string | null
          brand_name_raw?: string | null
          created_at?: string | null
          id?: string | null
          is_at_risk?: boolean | null
          is_delayed?: boolean | null
          is_unassigned?: boolean | null
          order_id?: string | null
          product_image_url?: string | null
          product_title?: string | null
          quantity?: number | null
          shopify_line_item_id?: string | null
          sku?: string | null
          sla_due_at?: string | null
          status?: string | null
          status_changed_at?: string | null
          status_changed_by?: string | null
          sub_order_number?: string | null
          updated_at?: string | null
          variant_title?: string | null
        }
        Update: {
          assigned_employee_id?: string | null
          brand_id?: string | null
          brand_name_raw?: string | null
          created_at?: string | null
          id?: string | null
          is_at_risk?: boolean | null
          is_delayed?: boolean | null
          is_unassigned?: boolean | null
          order_id?: string | null
          product_image_url?: string | null
          product_title?: string | null
          quantity?: number | null
          shopify_line_item_id?: string | null
          sku?: string | null
          sla_due_at?: string | null
          status?: string | null
          status_changed_at?: string | null
          status_changed_by?: string | null
          sub_order_number?: string | null
          updated_at?: string | null
          variant_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sub_orders_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "sub_orders_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "mv_top_brands_30d"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "sub_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_employee"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_status_changed_by_fkey"
            columns: ["status_changed_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "sub_orders_status_changed_by_fkey"
            columns: ["status_changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["key"]
          },
        ]
      }
      v_supplier_invoice_items_employee: {
        Row: {
          ai_confidence: Database["public"]["Enums"]["ai_confidence"] | null
          ai_match_score: number | null
          ai_reasoning: string | null
          barcode: string | null
          created_at: string | null
          description: string | null
          id: string | null
          mapped_at: string | null
          mapped_by: string | null
          mapped_sub_order_id: string | null
          quantity: number | null
          supplier_invoice_id: string | null
          updated_at: string | null
        }
        Insert: {
          ai_confidence?: Database["public"]["Enums"]["ai_confidence"] | null
          ai_match_score?: number | null
          ai_reasoning?: string | null
          barcode?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          mapped_at?: string | null
          mapped_by?: string | null
          mapped_sub_order_id?: string | null
          quantity?: number | null
          supplier_invoice_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_confidence?: Database["public"]["Enums"]["ai_confidence"] | null
          ai_match_score?: number | null
          ai_reasoning?: string | null
          barcode?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          mapped_at?: string | null
          mapped_by?: string | null
          mapped_sub_order_id?: string | null
          quantity?: number | null
          supplier_invoice_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoice_items_mapped_by_fkey"
            columns: ["mapped_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "supplier_invoice_items_mapped_by_fkey"
            columns: ["mapped_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_items_mapped_sub_order_id_fkey"
            columns: ["mapped_sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_items_mapped_sub_order_id_fkey"
            columns: ["mapped_sub_order_id"]
            isOneToOne: false
            referencedRelation: "v_sub_orders_employee"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_items_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_items_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_invoices_employee"
            referencedColumns: ["id"]
          },
        ]
      }
      v_supplier_invoices_employee: {
        Row: {
          created_at: string | null
          file_size_bytes: number | null
          id: string | null
          invoice_date: string | null
          mime_type: string | null
          notes: string | null
          ocr_extracted_at: string | null
          ocr_model_used: string | null
          ocr_state: Database["public"]["Enums"]["ocr_state"] | null
          original_filename: string | null
          source: string | null
          storage_path: string | null
          supplier_name: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_size_bytes?: number | null
          id?: string | null
          invoice_date?: string | null
          mime_type?: string | null
          notes?: string | null
          ocr_extracted_at?: string | null
          ocr_model_used?: string | null
          ocr_state?: Database["public"]["Enums"]["ocr_state"] | null
          original_filename?: string | null
          source?: string | null
          storage_path?: string | null
          supplier_name?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_size_bytes?: number | null
          id?: string | null
          invoice_date?: string | null
          mime_type?: string | null
          notes?: string | null
          ocr_extracted_at?: string | null
          ocr_model_used?: string | null
          ocr_state?: Database["public"]["Enums"]["ocr_state"] | null
          original_filename?: string | null
          source?: string | null
          storage_path?: string | null
          supplier_name?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "mv_team_performance_30d"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "supplier_invoices_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      archive_old_notifications: { Args: never; Returns: number }
      auto_assign_sub_order: {
        Args: { p_sub_order_id: string }
        Returns: string
      }
      command_palette_search: {
        Args: { p_limit?: number; p_query: string }
        Returns: Json
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      is_admin: { Args: { p_user_id: string }; Returns: boolean }
      jwt_has_role: { Args: { p_role: string }; Returns: boolean }
      jwt_is_admin: { Args: never; Returns: boolean }
      match_brand_from_vendor: { Args: { p_vendor: string }; Returns: string }
      next_invoice_sequence: { Args: { p_year: number }; Returns: string }
      prune_webhook_deliveries: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_has_role: {
        Args: {
          p_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      ai_confidence: "high" | "medium" | "low" | "failed"
      currency_code: "SAR" | "USD" | "EUR" | "GBP" | "AED"
      invoice_language: "en" | "ar" | "bilingual"
      invoice_status:
        | "draft"
        | "pending_review"
        | "approved"
        | "sent"
        | "rejected"
      notification_severity: "critical" | "warning" | "info" | "success"
      ocr_state: "uploaded" | "extracting" | "extracted" | "mapped" | "failed"
      region_code: "US" | "EU" | "KSA" | "GLOBAL"
      user_role:
        | "admin"
        | "sourcing"
        | "warehouse"
        | "fulfiller"
        | "ksa_operator"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_confidence: ["high", "medium", "low", "failed"],
      currency_code: ["SAR", "USD", "EUR", "GBP", "AED"],
      invoice_language: ["en", "ar", "bilingual"],
      invoice_status: [
        "draft",
        "pending_review",
        "approved",
        "sent",
        "rejected",
      ],
      notification_severity: ["critical", "warning", "info", "success"],
      ocr_state: ["uploaded", "extracting", "extracted", "mapped", "failed"],
      region_code: ["US", "EU", "KSA", "GLOBAL"],
      user_role: [
        "admin",
        "sourcing",
        "warehouse",
        "fulfiller",
        "ksa_operator",
      ],
    },
  },
} as const


// Hand-written aliases used across the app (preserved from prior stub).
export type Role = Database["public"]["Enums"]["user_role"];
export type Region = Database["public"]["Enums"]["region_code"];
export type Currency = Database["public"]["Enums"]["currency_code"];
