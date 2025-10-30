import { createContext, useContext, useEffect, useState } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { User, UserRole, UserLocation } from '@/types/database';
import { getUserHighestRole } from '@/lib/roleUtils';

interface AuthContextType {
  user: SupabaseUser | null;
  session: Session | null;
  userProfile: User | null;
  userRole: UserRole | null;
  userLocations: string[];
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userLocations, setUserLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // We'll handle navigation separately to avoid hook context issues
  const checkPasswordReset = (currentUser: SupabaseUser) => {
    if (currentUser?.user_metadata?.password_reset_required === true) {
      // Check if not already on change password page
      if (window.location.pathname !== '/change-password') {
        window.location.href = '/change-password';
      }
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserProfile(data as User);

      // Fetch highest role from user_roles table
      const highestRole = await getUserHighestRole(userId);
      setUserRole(highestRole);

      // Fetch user locations
      const { data: locationData, error: locationError } = await supabase
        .from('user_locations')
        .select('location_id')
        .eq('user_id', userId);

      if (!locationError && locationData) {
        setUserLocations(locationData.map(ul => ul.location_id));
      }

      // Check if password reset is required
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        checkPasswordReset(currentUser);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
      setUserRole(null);
      setUserLocations([]);
    } finally {
      // Set loading to false only after profile fetch completes
      setLoading(false);
    }
  };

  const refreshUserProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch user profile when authenticated
        if (session?.user) {
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setUserProfile(null);
          setUserRole(null);
          setLoading(false); // Only set loading false when no session
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false); // Only set loading false when no session
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserProfile(null);
    setUserRole(null);
    setUserLocations([]);
  };

  return (
    <AuthContext.Provider value={{ user, session, userProfile, userRole, userLocations, loading, signOut, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
