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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          billing_address: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          default_class: string | null
          default_terms: string | null
          id: string
          is_active: boolean
          is_taxable: boolean | null
          name: string
          parent_company: string | null
          tax_jurisdiction: string | null
        }
        Insert: {
          billing_address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          default_class?: string | null
          default_terms?: string | null
          id?: string
          is_active?: boolean
          is_taxable?: boolean | null
          name: string
          parent_company?: string | null
          tax_jurisdiction?: string | null
        }
        Update: {
          billing_address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          default_class?: string | null
          default_terms?: string | null
          id?: string
          is_active?: boolean
          is_taxable?: boolean | null
          name?: string
          parent_company?: string | null
          tax_jurisdiction?: string | null
        }
        Relationships: []
      }
      employee_comments: {
        Row: {
          comment_text: string
          created_at: string
          employee_id: string
          id: string
          location_id: string | null
          week_start_date: string
        }
        Insert: {
          comment_text: string
          created_at?: string
          employee_id: string
          id?: string
          location_id?: string | null
          week_start_date: string
        }
        Update: {
          comment_text?: string
          created_at?: string
          employee_id?: string
          id?: string
          location_id?: string | null
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_comments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_comments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          address?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          address?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_approval_requests: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          manager_id: string
          reason: string | null
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          wash_entry_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          manager_id: string
          reason?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          wash_entry_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          manager_id?: string
          reason?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          wash_entry_id?: string
        }
        Relationships: []
      }
      message_reads: {
        Row: {
          comment_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "employee_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      message_replies: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reply_text: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reply_text: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reply_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_replies_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "employee_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_configs: {
        Row: {
          client_id: string
          created_at: string
          frequency: string | null
          id: string
          is_active: boolean
          location_id: string
          needs_rate_review: boolean
          rate: number | null
          work_type_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          frequency?: string | null
          id?: string
          is_active?: boolean
          location_id: string
          needs_rate_review?: boolean
          rate?: number | null
          work_type_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          frequency?: string | null
          id?: string
          is_active?: boolean
          location_id?: string
          needs_rate_review?: boolean
          rate?: number | null
          work_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_configs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_configs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_configs_work_type_id_fkey"
            columns: ["work_type_id"]
            isOneToOne: false
            referencedRelation: "work_types"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_shared: boolean
          is_system_template: boolean
          last_used_at: string | null
          report_type: string
          template_name: string
          updated_at: string
          use_count: number
        }
        Insert: {
          config: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_shared?: boolean
          is_system_template?: boolean
          last_used_at?: string | null
          report_type: string
          template_name: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_shared?: boolean
          is_system_template?: boolean
          last_used_at?: string | null
          report_type?: string
          template_name?: string
          updated_at?: string
          use_count?: number
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          category: string | null
          data_type: string | null
          description: string | null
          id: string
          is_public: boolean | null
          setting_key: string
          setting_value: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          data_type?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          setting_key: string
          setting_value: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          data_type?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          setting_key?: string
          setting_value?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings_audit: {
        Row: {
          change_reason: string | null
          changed_at: string | null
          changed_by: string | null
          id: string
          new_value: string
          old_value: string | null
          setting_key: string
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_value: string
          old_value?: string | null
          setting_key: string
        }
        Update: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_value?: string
          old_value?: string | null
          setting_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_settings_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      user_locations: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          location_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          location_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          location_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      user_message_views: {
        Row: {
          created_at: string
          id: string
          last_viewed_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_viewed_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_viewed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_message_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_message_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          account_locked_until: string | null
          assigned_clients: string[] | null
          available_days: string[] | null
          average_wash_time_minutes: number | null
          bio: string | null
          certification_expiry_dates: Json | null
          certifications: string[] | null
          client_access_level: string | null
          commission_percentage: number | null
          created_at: string
          date_of_birth: string | null
          default_shift: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_id: string
          failed_login_attempts: number | null
          hire_date: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          last_login_ip: string | null
          last_training_date: string | null
          location_id: string | null
          manager_id: string | null
          max_daily_washes: number | null
          must_change_password: boolean | null
          name: string
          notes: string | null
          on_vacation: boolean | null
          password_changed_at: string | null
          pay_rate: number | null
          pay_type: string | null
          performance_rating: number | null
          phone_number: string | null
          preferred_language: string | null
          profile_photo_url: string | null
          quality_score_average: number | null
          role: string
          tags: string[] | null
          termination_date: string | null
          total_revenue_generated: number | null
          total_washes_completed: number | null
          training_completed: string[] | null
          two_factor_enabled: boolean | null
          vacation_until: string | null
        }
        Insert: {
          account_locked_until?: string | null
          assigned_clients?: string[] | null
          available_days?: string[] | null
          average_wash_time_minutes?: number | null
          bio?: string | null
          certification_expiry_dates?: Json | null
          certifications?: string[] | null
          client_access_level?: string | null
          commission_percentage?: number | null
          created_at?: string
          date_of_birth?: string | null
          default_shift?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id: string
          failed_login_attempts?: number | null
          hire_date?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          last_login_ip?: string | null
          last_training_date?: string | null
          location_id?: string | null
          manager_id?: string | null
          max_daily_washes?: number | null
          must_change_password?: boolean | null
          name: string
          notes?: string | null
          on_vacation?: boolean | null
          password_changed_at?: string | null
          pay_rate?: number | null
          pay_type?: string | null
          performance_rating?: number | null
          phone_number?: string | null
          preferred_language?: string | null
          profile_photo_url?: string | null
          quality_score_average?: number | null
          role: string
          tags?: string[] | null
          termination_date?: string | null
          total_revenue_generated?: number | null
          total_washes_completed?: number | null
          training_completed?: string[] | null
          two_factor_enabled?: boolean | null
          vacation_until?: string | null
        }
        Update: {
          account_locked_until?: string | null
          assigned_clients?: string[] | null
          available_days?: string[] | null
          average_wash_time_minutes?: number | null
          bio?: string | null
          certification_expiry_dates?: Json | null
          certifications?: string[] | null
          client_access_level?: string | null
          commission_percentage?: number | null
          created_at?: string
          date_of_birth?: string | null
          default_shift?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id?: string
          failed_login_attempts?: number | null
          hire_date?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          last_login_ip?: string | null
          last_training_date?: string | null
          location_id?: string | null
          manager_id?: string | null
          max_daily_washes?: number | null
          must_change_password?: boolean | null
          name?: string
          notes?: string | null
          on_vacation?: boolean | null
          password_changed_at?: string | null
          pay_rate?: number | null
          pay_type?: string | null
          performance_rating?: number | null
          phone_number?: string | null
          preferred_language?: string | null
          profile_photo_url?: string | null
          quality_score_average?: number | null
          role?: string
          tags?: string[] | null
          termination_date?: string | null
          total_revenue_generated?: number | null
          total_washes_completed?: number | null
          training_completed?: string[] | null
          two_factor_enabled?: boolean | null
          vacation_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      work_items: {
        Row: {
          created_at: string
          id: string
          identifier: string
          is_active: boolean
          rate_config_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          is_active?: boolean
          rate_config_id: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          is_active?: boolean
          rate_config_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_items_rate_config_id_fkey"
            columns: ["rate_config_id"]
            isOneToOne: false
            referencedRelation: "rate_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      work_logs: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          quantity: number
          rate_config_id: string | null
          work_date: string
          work_item_id: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          quantity: number
          rate_config_id?: string | null
          work_date: string
          work_item_id?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          quantity?: number
          rate_config_id?: string | null
          work_date?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_rate_config_id_fkey"
            columns: ["rate_config_id"]
            isOneToOne: false
            referencedRelation: "rate_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          rate_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          rate_type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          rate_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      users_safe_view: {
        Row: {
          assigned_clients: string[] | null
          available_days: string[] | null
          average_wash_time_minutes: number | null
          certifications: string[] | null
          client_access_level: string | null
          created_at: string | null
          default_shift: string | null
          email: string | null
          employee_id: string | null
          hire_date: string | null
          id: string | null
          is_active: boolean | null
          last_training_date: string | null
          location_id: string | null
          manager_id: string | null
          max_daily_washes: number | null
          name: string | null
          notes: string | null
          on_vacation: boolean | null
          performance_rating: number | null
          preferred_language: string | null
          profile_photo_url: string | null
          quality_score_average: number | null
          role: string | null
          tags: string[] | null
          termination_date: string | null
          total_washes_completed: number | null
          training_completed: string[] | null
          vacation_until: string | null
        }
        Insert: {
          assigned_clients?: string[] | null
          available_days?: string[] | null
          average_wash_time_minutes?: number | null
          certifications?: string[] | null
          client_access_level?: string | null
          created_at?: string | null
          default_shift?: string | null
          email?: string | null
          employee_id?: string | null
          hire_date?: string | null
          id?: string | null
          is_active?: boolean | null
          last_training_date?: string | null
          location_id?: string | null
          manager_id?: string | null
          max_daily_washes?: number | null
          name?: string | null
          notes?: string | null
          on_vacation?: boolean | null
          performance_rating?: number | null
          preferred_language?: string | null
          profile_photo_url?: string | null
          quality_score_average?: number | null
          role?: string | null
          tags?: string[] | null
          termination_date?: string | null
          total_washes_completed?: number | null
          training_completed?: string[] | null
          vacation_until?: string | null
        }
        Update: {
          assigned_clients?: string[] | null
          available_days?: string[] | null
          average_wash_time_minutes?: number | null
          certifications?: string[] | null
          client_access_level?: string | null
          created_at?: string | null
          default_shift?: string | null
          email?: string | null
          employee_id?: string | null
          hire_date?: string | null
          id?: string | null
          is_active?: boolean | null
          last_training_date?: string | null
          location_id?: string | null
          manager_id?: string | null
          max_daily_washes?: number | null
          name?: string | null
          notes?: string | null
          on_vacation?: boolean | null
          performance_rating?: number | null
          preferred_language?: string | null
          profile_photo_url?: string | null
          quality_score_average?: number | null
          role?: string | null
          tags?: string[] | null
          termination_date?: string | null
          total_washes_completed?: number | null
          training_completed?: string[] | null
          vacation_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auto_update_cutoff_date: { Args: never; Returns: undefined }
      get_applicable_rate: {
        Args: {
          p_client_id?: string
          p_frequency_id?: string
          p_location_id: string
          p_service_category_id?: string
          p_vehicle_type_id?: string
          p_work_date?: string
        }
        Returns: {
          is_hourly: boolean
          rate: number
          rate_source: string
        }[]
      }
      get_last_monday: { Args: never; Returns: string }
      get_next_sunday: { Args: never; Returns: string }
      get_report_data: {
        Args: {
          p_client_ids?: string[]
          p_end_date: string
          p_location_ids?: string[]
          p_start_date: string
          p_work_type_ids?: string[]
        }
        Returns: {
          client_class: string
          client_email: string
          client_id: string
          client_is_taxable: boolean
          client_name: string
          client_tax_jurisdiction: string
          client_terms: string
          frequency: string
          location_id: string
          location_name: string
          rate: number
          total_quantity: number
          work_type_id: string
          work_type_name: string
        }[]
      }
      get_users_for_managers: {
        Args: never
        Returns: {
          assigned_clients: string[]
          available_days: string[]
          average_wash_time_minutes: number
          certifications: string[]
          client_access_level: string
          created_at: string
          default_shift: string
          email: string
          employee_id: string
          hire_date: string
          id: string
          is_active: boolean
          last_training_date: string
          location_id: string
          manager_id: string
          max_daily_washes: number
          name: string
          notes: string
          on_vacation: boolean
          performance_rating: number
          preferred_language: string
          profile_photo_url: string
          quality_score_average: number
          role: string
          tags: string[]
          termination_date: string
          total_washes_completed: number
          training_completed: string[]
          vacation_until: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_or_higher: {
        Args: {
          _required_role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "employee" | "manager" | "finance" | "admin" | "super_admin"
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
      app_role: ["employee", "manager", "finance", "admin", "super_admin"],
    },
  },
} as const
