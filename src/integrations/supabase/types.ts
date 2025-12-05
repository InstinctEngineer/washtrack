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
      client_contacts: {
        Row: {
          client_id: string
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          contact_title: string | null
          contact_type: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
        }
        Insert: {
          client_id: string
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          contact_title?: string | null
          contact_type?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
        }
        Update: {
          client_id?: string
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          contact_title?: string | null
          contact_type?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_locations: {
        Row: {
          activated_at: string | null
          client_id: string
          created_at: string | null
          created_by: string | null
          deactivated_at: string | null
          id: string
          is_active: boolean | null
          is_primary_location: boolean | null
          location_id: string
          priority_level: string | null
          rate_multiplier: number | null
        }
        Insert: {
          activated_at?: string | null
          client_id: string
          created_at?: string | null
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary_location?: boolean | null
          location_id: string
          priority_level?: string | null
          rate_multiplier?: number | null
        }
        Update: {
          activated_at?: string | null
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          deactivated_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary_location?: boolean | null
          location_id?: string
          priority_level?: string | null
          rate_multiplier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string
          id: string
          is_pinned: boolean | null
          note_text: string
          note_type: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by: string
          id?: string
          is_pinned?: boolean | null
          note_text: string
          note_type?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_pinned?: boolean | null
          note_text?: string
          note_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      client_vehicle_rates: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string | null
          custom_rate: number
          effective_date: string
          expiration_date: string | null
          id: string
          vehicle_type_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by?: string | null
          custom_rate: number
          effective_date: string
          expiration_date?: string | null
          id?: string
          vehicle_type_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          custom_rate?: number
          effective_date?: string
          expiration_date?: string | null
          id?: string
          vehicle_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_vehicle_rates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_vehicle_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_vehicle_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_vehicle_rates_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_status: string | null
          auto_renew: boolean | null
          billing_address: string | null
          billing_city: string | null
          billing_contact_email: string | null
          billing_contact_name: string | null
          billing_contact_phone: string | null
          billing_country: string | null
          billing_state: string | null
          billing_zip: string | null
          client_code: string
          client_name: string
          contract_end_date: string | null
          contract_number: string | null
          contract_start_date: string | null
          created_at: string | null
          created_by: string | null
          credit_limit: number | null
          current_balance: number | null
          deleted_at: string | null
          deleted_by: string | null
          discount_percentage: number | null
          id: string
          industry: string | null
          invoice_frequency: string | null
          is_active: boolean | null
          legal_business_name: string | null
          notes: string | null
          payment_terms: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          requires_po_number: boolean | null
          tags: string[] | null
          tax_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          account_status?: string | null
          auto_renew?: boolean | null
          billing_address?: string | null
          billing_city?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_contact_phone?: string | null
          billing_country?: string | null
          billing_state?: string | null
          billing_zip?: string | null
          client_code: string
          client_name: string
          contract_end_date?: string | null
          contract_number?: string | null
          contract_start_date?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          discount_percentage?: number | null
          id?: string
          industry?: string | null
          invoice_frequency?: string | null
          is_active?: boolean | null
          legal_business_name?: string | null
          notes?: string | null
          payment_terms?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          requires_po_number?: boolean | null
          tags?: string[] | null
          tax_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          account_status?: string | null
          auto_renew?: boolean | null
          billing_address?: string | null
          billing_city?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_contact_phone?: string | null
          billing_country?: string | null
          billing_state?: string | null
          billing_zip?: string | null
          client_code?: string
          client_name?: string
          contract_end_date?: string | null
          contract_number?: string | null
          contract_start_date?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          discount_percentage?: number | null
          id?: string
          industry?: string | null
          invoice_frequency?: string | null
          is_active?: boolean | null
          legal_business_name?: string | null
          notes?: string | null
          payment_terms?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          requires_po_number?: boolean | null
          tags?: string[] | null
          tax_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          average_washes_per_day: number | null
          billing_address: string | null
          billing_contact: string | null
          city: string | null
          closed_on: string[] | null
          contact_person: string | null
          country: string | null
          created_at: string
          current_capacity_used: number | null
          current_clients_count: number | null
          email: string | null
          equipment_list: string[] | null
          has_covered_area: boolean | null
          has_detail_bay: boolean | null
          has_pressure_washer: boolean | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          manager_user_id: string | null
          max_clients_serviced: number | null
          max_daily_capacity: number | null
          name: string
          notes: string | null
          operating_hours: Json | null
          phone_number: string | null
          photo_url: string | null
          state: string | null
          tax_rate: number | null
          timezone: string | null
          total_revenue: number | null
          total_washes_completed: number | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          average_washes_per_day?: number | null
          billing_address?: string | null
          billing_contact?: string | null
          city?: string | null
          closed_on?: string[] | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          current_capacity_used?: number | null
          current_clients_count?: number | null
          email?: string | null
          equipment_list?: string[] | null
          has_covered_area?: boolean | null
          has_detail_bay?: boolean | null
          has_pressure_washer?: boolean | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          manager_user_id?: string | null
          max_clients_serviced?: number | null
          max_daily_capacity?: number | null
          name: string
          notes?: string | null
          operating_hours?: Json | null
          phone_number?: string | null
          photo_url?: string | null
          state?: string | null
          tax_rate?: number | null
          timezone?: string | null
          total_revenue?: number | null
          total_washes_completed?: number | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          average_washes_per_day?: number | null
          billing_address?: string | null
          billing_contact?: string | null
          city?: string | null
          closed_on?: string[] | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          current_capacity_used?: number | null
          current_clients_count?: number | null
          email?: string | null
          equipment_list?: string[] | null
          has_covered_area?: boolean | null
          has_detail_bay?: boolean | null
          has_pressure_washer?: boolean | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          manager_user_id?: string | null
          max_clients_serviced?: number | null
          max_daily_capacity?: number | null
          name?: string
          notes?: string | null
          operating_hours?: Json | null
          phone_number?: string | null
          photo_url?: string | null
          state?: string | null
          tax_rate?: number | null
          timezone?: string | null
          total_revenue?: number | null
          total_washes_completed?: number | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_manager_user_id_fkey"
            columns: ["manager_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_manager_user_id_fkey"
            columns: ["manager_user_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
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
        Relationships: [
          {
            foreignKeyName: "manager_approval_requests_wash_entry_id_fkey"
            columns: ["wash_entry_id"]
            isOneToOne: false
            referencedRelation: "wash_entries"
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
      vehicle_types: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          estimated_wash_time_minutes: number | null
          icon_name: string | null
          id: string
          is_active: boolean
          rate_per_wash: number
          requires_special_training: boolean | null
          sort_order: number | null
          type_name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          estimated_wash_time_minutes?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean
          rate_per_wash: number
          requires_special_training?: boolean | null
          sort_order?: number | null
          type_name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          estimated_wash_time_minutes?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean
          rate_per_wash?: number
          requires_special_training?: boolean | null
          sort_order?: number | null
          type_name?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          assigned_driver_id: string | null
          billing_code: string | null
          client_id: string | null
          client_vehicle_number: string | null
          color: string | null
          contract_number: string | null
          created_at: string
          current_condition: string | null
          current_odometer: number | null
          custom_rate: number | null
          estimated_wash_time_minutes: number | null
          flag_reason: string | null
          flagged: boolean | null
          fleet_number: string | null
          height_feet: number | null
          home_location_id: string | null
          id: string
          is_active: boolean
          last_maintenance_date: string | null
          last_seen_date: string | null
          last_seen_location_id: string | null
          last_wash_employee_id: string | null
          last_wash_quality_rating: number | null
          length_feet: number | null
          license_plate: string | null
          maintenance_notes: string | null
          make: string | null
          model: string | null
          next_maintenance_due_date: string | null
          notes: string | null
          owner_contact: string | null
          owner_name: string | null
          photo_thumbnail_url: string | null
          photo_url: string | null
          requires_special_equipment: boolean | null
          special_equipment_notes: string | null
          tags: string[] | null
          total_washes_completed: number | null
          vehicle_number: string
          vehicle_type_id: string
          vin: string | null
          wash_frequency_days: number | null
          weight_tons: number | null
          width_feet: number | null
          year: number | null
        }
        Insert: {
          assigned_driver_id?: string | null
          billing_code?: string | null
          client_id?: string | null
          client_vehicle_number?: string | null
          color?: string | null
          contract_number?: string | null
          created_at?: string
          current_condition?: string | null
          current_odometer?: number | null
          custom_rate?: number | null
          estimated_wash_time_minutes?: number | null
          flag_reason?: string | null
          flagged?: boolean | null
          fleet_number?: string | null
          height_feet?: number | null
          home_location_id?: string | null
          id?: string
          is_active?: boolean
          last_maintenance_date?: string | null
          last_seen_date?: string | null
          last_seen_location_id?: string | null
          last_wash_employee_id?: string | null
          last_wash_quality_rating?: number | null
          length_feet?: number | null
          license_plate?: string | null
          maintenance_notes?: string | null
          make?: string | null
          model?: string | null
          next_maintenance_due_date?: string | null
          notes?: string | null
          owner_contact?: string | null
          owner_name?: string | null
          photo_thumbnail_url?: string | null
          photo_url?: string | null
          requires_special_equipment?: boolean | null
          special_equipment_notes?: string | null
          tags?: string[] | null
          total_washes_completed?: number | null
          vehicle_number: string
          vehicle_type_id: string
          vin?: string | null
          wash_frequency_days?: number | null
          weight_tons?: number | null
          width_feet?: number | null
          year?: number | null
        }
        Update: {
          assigned_driver_id?: string | null
          billing_code?: string | null
          client_id?: string | null
          client_vehicle_number?: string | null
          color?: string | null
          contract_number?: string | null
          created_at?: string
          current_condition?: string | null
          current_odometer?: number | null
          custom_rate?: number | null
          estimated_wash_time_minutes?: number | null
          flag_reason?: string | null
          flagged?: boolean | null
          fleet_number?: string | null
          height_feet?: number | null
          home_location_id?: string | null
          id?: string
          is_active?: boolean
          last_maintenance_date?: string | null
          last_seen_date?: string | null
          last_seen_location_id?: string | null
          last_wash_employee_id?: string | null
          last_wash_quality_rating?: number | null
          length_feet?: number | null
          license_plate?: string | null
          maintenance_notes?: string | null
          make?: string | null
          model?: string | null
          next_maintenance_due_date?: string | null
          notes?: string | null
          owner_contact?: string | null
          owner_name?: string | null
          photo_thumbnail_url?: string | null
          photo_url?: string | null
          requires_special_equipment?: boolean | null
          special_equipment_notes?: string | null
          tags?: string[] | null
          total_washes_completed?: number | null
          vehicle_number?: string
          vehicle_type_id?: string
          vin?: string | null
          wash_frequency_days?: number | null
          weight_tons?: number | null
          width_feet?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_home_location_id_fkey"
            columns: ["home_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_last_seen_location_id_fkey"
            columns: ["last_seen_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_last_wash_employee_id_fkey"
            columns: ["last_wash_employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_last_wash_employee_id_fkey"
            columns: ["last_wash_employee_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      wash_entries: {
        Row: {
          actual_location_id: string
          additional_charges: number | null
          additional_charges_reason: string | null
          additional_services: string[] | null
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          break_duration_minutes: number | null
          client_id: string | null
          comment: string | null
          condition_after: string | null
          condition_before: string | null
          created_at: string
          customer_complaint: string | null
          customer_po_number: string | null
          customer_satisfaction: number | null
          customer_signature_url: string | null
          damage_description: string | null
          damage_reported: boolean | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          discount_percentage: number | null
          employee_id: string
          employee_notes: string | null
          final_amount: number | null
          flag_reason: string | null
          flagged: boolean | null
          fuel_level: string | null
          id: string
          odometer_reading: number | null
          photo_after_url: string | null
          photo_before_url: string | null
          photo_damage_url: string | null
          photo_proof_url: string | null
          priority: string | null
          quality_checked: boolean | null
          quality_checked_at: string | null
          quality_checked_by: string | null
          quality_rating: number | null
          rate_at_time_of_wash: number | null
          rate_override: number | null
          rate_override_reason: string | null
          requires_approval: boolean | null
          rework_completed_at: string | null
          rework_reason: string | null
          rework_required: boolean | null
          service_type: string | null
          soap_used_gallons: number | null
          source: string | null
          special_instructions: string | null
          supplies_cost: number | null
          temperature_fahrenheit: number | null
          time_completed: string | null
          time_started: string | null
          vehicle_id: string
          warranty_applies: boolean | null
          warranty_expiration_date: string | null
          wash_date: string
          wash_duration_minutes: number | null
          wash_location_type: string | null
          water_used_gallons: number | null
          weather_condition: string | null
        }
        Insert: {
          actual_location_id: string
          additional_charges?: number | null
          additional_charges_reason?: string | null
          additional_services?: string[] | null
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          break_duration_minutes?: number | null
          client_id?: string | null
          comment?: string | null
          condition_after?: string | null
          condition_before?: string | null
          created_at?: string
          customer_complaint?: string | null
          customer_po_number?: string | null
          customer_satisfaction?: number | null
          customer_signature_url?: string | null
          damage_description?: string | null
          damage_reported?: boolean | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          discount_percentage?: number | null
          employee_id: string
          employee_notes?: string | null
          final_amount?: number | null
          flag_reason?: string | null
          flagged?: boolean | null
          fuel_level?: string | null
          id?: string
          odometer_reading?: number | null
          photo_after_url?: string | null
          photo_before_url?: string | null
          photo_damage_url?: string | null
          photo_proof_url?: string | null
          priority?: string | null
          quality_checked?: boolean | null
          quality_checked_at?: string | null
          quality_checked_by?: string | null
          quality_rating?: number | null
          rate_at_time_of_wash?: number | null
          rate_override?: number | null
          rate_override_reason?: string | null
          requires_approval?: boolean | null
          rework_completed_at?: string | null
          rework_reason?: string | null
          rework_required?: boolean | null
          service_type?: string | null
          soap_used_gallons?: number | null
          source?: string | null
          special_instructions?: string | null
          supplies_cost?: number | null
          temperature_fahrenheit?: number | null
          time_completed?: string | null
          time_started?: string | null
          vehicle_id: string
          warranty_applies?: boolean | null
          warranty_expiration_date?: string | null
          wash_date: string
          wash_duration_minutes?: number | null
          wash_location_type?: string | null
          water_used_gallons?: number | null
          weather_condition?: string | null
        }
        Update: {
          actual_location_id?: string
          additional_charges?: number | null
          additional_charges_reason?: string | null
          additional_services?: string[] | null
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          break_duration_minutes?: number | null
          client_id?: string | null
          comment?: string | null
          condition_after?: string | null
          condition_before?: string | null
          created_at?: string
          customer_complaint?: string | null
          customer_po_number?: string | null
          customer_satisfaction?: number | null
          customer_signature_url?: string | null
          damage_description?: string | null
          damage_reported?: boolean | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          discount_percentage?: number | null
          employee_id?: string
          employee_notes?: string | null
          final_amount?: number | null
          flag_reason?: string | null
          flagged?: boolean | null
          fuel_level?: string | null
          id?: string
          odometer_reading?: number | null
          photo_after_url?: string | null
          photo_before_url?: string | null
          photo_damage_url?: string | null
          photo_proof_url?: string | null
          priority?: string | null
          quality_checked?: boolean | null
          quality_checked_at?: string | null
          quality_checked_by?: string | null
          quality_rating?: number | null
          rate_at_time_of_wash?: number | null
          rate_override?: number | null
          rate_override_reason?: string | null
          requires_approval?: boolean | null
          rework_completed_at?: string | null
          rework_reason?: string | null
          rework_required?: boolean | null
          service_type?: string | null
          soap_used_gallons?: number | null
          source?: string | null
          special_instructions?: string | null
          supplies_cost?: number | null
          temperature_fahrenheit?: number | null
          time_completed?: string | null
          time_started?: string | null
          vehicle_id?: string
          warranty_applies?: boolean | null
          warranty_expiration_date?: string | null
          wash_date?: string
          wash_duration_minutes?: number | null
          wash_location_type?: string | null
          water_used_gallons?: number | null
          weather_condition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wash_entries_actual_location_id_fkey"
            columns: ["actual_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wash_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wash_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wash_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wash_entries_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wash_entries_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wash_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wash_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wash_entries_quality_checked_by_fkey"
            columns: ["quality_checked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wash_entries_quality_checked_by_fkey"
            columns: ["quality_checked_by"]
            isOneToOne: false
            referencedRelation: "users_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wash_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
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
      get_last_sunday: { Args: never; Returns: string }
      get_next_saturday: { Args: never; Returns: string }
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
