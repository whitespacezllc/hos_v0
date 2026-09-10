export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      instructors: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          bio: string | null;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          bio?: string | null;
          photo_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          bio?: string | null;
          photo_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      class_templates: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          instructor_id: string | null;
          day_of_week: number;
          time_start: string;
          duration_minutes: number;
          capacity: number;
          price_dropin_usd: number;
          location: string;
          color: string | null;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          instructor_id?: string | null;
          day_of_week: number;
          time_start: string;
          duration_minutes?: number;
          capacity?: number;
          price_dropin_usd?: number;
          location?: string;
          color?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          instructor_id?: string | null;
          day_of_week?: number;
          time_start?: string;
          duration_minutes?: number;
          capacity?: number;
          price_dropin_usd?: number;
          location?: string;
          color?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      classes: {
        Row: {
          id: string;
          template_id: string | null;
          instructor_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          starts_at: string;
          duration_minutes: number;
          capacity: number;
          spots_remaining: number;
          price_dropin_usd: number;
          location: string;
          color: string | null;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id?: string | null;
          instructor_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          starts_at: string;
          duration_minutes?: number;
          capacity?: number;
          spots_remaining?: number;
          price_dropin_usd?: number;
          location?: string;
          color?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string | null;
          instructor_id?: string | null;
          name?: string;
          slug?: string;
          description?: string | null;
          starts_at?: string;
          duration_minutes?: number;
          capacity?: number;
          spots_remaining?: number;
          price_dropin_usd?: number;
          location?: string;
          color?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      class_packs: {
        Row: {
          id: string;
          name: string;
          classes_count: number;
          price_usd: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          classes_count: number;
          price_usd: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          classes_count?: number;
          price_usd?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      pack_purchases: {
        Row: {
          id: string;
          pack_id: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          code: string | null;
          classes_total: number;
          classes_used: number;
          status: string;
          payment_method: 'card' | 'cash' | 'venmo';
          amount_usd: number | null;
          created_at: string;
          paid_at: string | null;
        };
        Insert: {
          id?: string;
          pack_id?: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string | null;
          code?: string | null;
          classes_total: number;
          classes_used?: number;
          status?: string;
          payment_method?: 'card' | 'cash' | 'venmo';
          amount_usd?: number | null;
          created_at?: string;
          paid_at?: string | null;
        };
        Update: {
          id?: string;
          pack_id?: string | null;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string | null;
          code?: string | null;
          classes_total?: number;
          classes_used?: number;
          status?: string;
          payment_method?: 'card' | 'cash' | 'venmo';
          amount_usd?: number | null;
          created_at?: string;
          paid_at?: string | null;
        };
        Relationships: [];
      };
      upsells: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price_usd: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          price_usd?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          price_usd?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          class_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          persons: number;
          upsell_ids: string[];
          payment_status: 'pending' | 'confirmed' | 'cancelled' | 'no-show';
          payment_method: 'card' | 'cash' | 'venmo';
          pack_type: string | null;
          booking_reference: string;
          referral_code: string | null;
          is_hotel_guest: boolean;
          cloudbeds_ref: string | null;
          total_usd: number | null;
          notes: string | null;
          pack_purchase_id: string | null;
          tilopay_transaction: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string | null;
          persons?: number;
          upsell_ids?: string[];
          payment_status?: 'pending' | 'confirmed' | 'cancelled' | 'no-show';
          payment_method?: 'card' | 'cash' | 'venmo';
          pack_type?: string | null;
          booking_reference: string;
          referral_code?: string | null;
          is_hotel_guest?: boolean;
          cloudbeds_ref?: string | null;
          total_usd?: number | null;
          notes?: string | null;
          pack_purchase_id?: string | null;
          tilopay_transaction?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string | null;
          persons?: number;
          upsell_ids?: string[];
          payment_status?: 'pending' | 'confirmed' | 'cancelled' | 'no-show';
          payment_method?: 'card' | 'cash' | 'venmo';
          pack_type?: string | null;
          booking_reference?: string;
          referral_code?: string | null;
          is_hotel_guest?: boolean;
          cloudbeds_ref?: string | null;
          total_usd?: number | null;
          notes?: string | null;
          pack_purchase_id?: string | null;
          tilopay_transaction?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      referral_codes: {
        Row: {
          id: string;
          code: string;
          partner_name: string;
          description: string | null;
          benefit_type: 'percentage' | 'fixed' | 'free_upsell';
          discount_percent: number | null;
          discount_fixed: number | null;
          free_upsell_id: string | null;
          is_active: boolean;
          usage_limit: number | null;
          usage_count: number;
          valid_from: string | null;
          valid_until: string | null;
          min_purchase_usd: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          partner_name: string;
          description?: string | null;
          benefit_type: 'percentage' | 'fixed' | 'free_upsell';
          discount_percent?: number | null;
          discount_fixed?: number | null;
          free_upsell_id?: string | null;
          is_active?: boolean;
          usage_limit?: number | null;
          usage_count?: number;
          valid_from?: string | null;
          valid_until?: string | null;
          min_purchase_usd?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          partner_name?: string;
          description?: string | null;
          benefit_type?: 'percentage' | 'fixed' | 'free_upsell';
          discount_percent?: number | null;
          discount_fixed?: number | null;
          free_upsell_id?: string | null;
          is_active?: boolean;
          usage_limit?: number | null;
          usage_count?: number;
          valid_from?: string | null;
          valid_until?: string | null;
          min_purchase_usd?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      retreat_listings: {
        Row: {
          id: string;
          title: string;
          label: string;
          instructors: string;
          starts_on: string;
          ends_on: string;
          description: string;
          url: string;
          image_url: string | null;
          image_alt: string | null;
          image_alt_es: string | null;
          label_es: string | null;
          description_es: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          label: string;
          instructors: string;
          starts_on: string;
          ends_on: string;
          description: string;
          url: string;
          image_url?: string | null;
          image_alt?: string | null;
          image_alt_es?: string | null;
          label_es?: string | null;
          description_es?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          label?: string;
          instructors?: string;
          starts_on?: string;
          ends_on?: string;
          description?: string;
          url?: string;
          image_url?: string | null;
          image_alt?: string | null;
          image_alt_es?: string | null;
          label_es?: string | null;
          description_es?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      retreat_submissions: {
        Row: {
          id: string;
          retreat_name: string;
          retreat_slug: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          selected_date: string | null;
          participants: number;
          message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          retreat_name: string;
          retreat_slug?: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string | null;
          selected_date?: string | null;
          participants?: number;
          message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          retreat_name?: string;
          retreat_slug?: string | null;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string | null;
          selected_date?: string | null;
          participants?: number;
          message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      decrement_spots: {
        Args: { p_class_id: string };
        Returns: Json;
      };
      increment_spots: {
        Args: { p_class_id: string };
        Returns: Json;
      };
      generate_booking_reference: {
        Args: Record<string, never>;
        Returns: string;
      };
      generate_week_classes: {
        Args: { p_week_start: string };
        Returns: number;
      };
      generate_pack_code: {
        Args: Record<string, never>;
        Returns: string;
      };
      redeem_pack_code: {
        Args: { p_code: string };
        Returns: Json;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
