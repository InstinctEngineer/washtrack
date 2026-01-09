import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, X, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { findSimilarMatches } from '@/lib/fuzzyMatch';

interface UserOption {
  id: string;
  name: string;
  email: string;
  employee_id: string;
}

interface UserSearchInputProps {
  onUserSelect: (user: UserOption | null) => void;
  selectedUser: UserOption | null;
  placeholder?: string;
  excludeUserId?: string;
}

export function UserSearchInput({ 
  onUserSelect, 
  selectedUser, 
  placeholder = "Search for user...",
  excludeUserId
}: UserSearchInputProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [suggestions, setSuggestions] = useState<UserOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch all active users once on mount
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('users_safe_view')
        .select('id, name, email, employee_id')
        .eq('is_active', true)
        .order('name');

      if (!error && data) {
        const users = data
          .filter(u => u.id && u.name && u.email && u.id !== excludeUserId)
          .map(u => ({
            id: u.id!,
            name: u.name!,
            email: u.email!,
            employee_id: u.employee_id || ''
          }));
        setAllUsers(users);
      }
      setIsLoading(false);
    };

    fetchUsers();
  }, [excludeUserId]);

  // Filter suggestions based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    // Use fuzzy matching for name, also check email directly
    const nameMatches = findSimilarMatches(
      searchQuery,
      allUsers,
      0.3,
      10
    );

    // Also include direct email/employee_id matches
    const emailMatches = allUsers.filter(u => 
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.employee_id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Combine and deduplicate
    const matchedIds = new Set(nameMatches.map(m => m.item.id));
    const combined = [
      ...nameMatches.map(m => m.item),
      ...emailMatches.filter(u => !matchedIds.has(u.id))
    ].slice(0, 5);

    setSuggestions(combined);
  }, [searchQuery, allUsers]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (user: UserOption) => {
    onUserSelect(user);
    setSearchQuery('');
    setSuggestions([]);
    setIsOpen(false);
  };

  const handleClear = () => {
    onUserSelect(null);
    setSearchQuery('');
    inputRef.current?.focus();
  };

  if (selectedUser) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="flex items-center gap-2 py-1.5 px-3">
          <User className="h-3.5 w-3.5" />
          <span>{selectedUser.name}</span>
          <span className="text-muted-foreground text-xs">({selectedUser.email})</span>
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-7 w-7 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-9"
        />
      </div>

      {isOpen && searchQuery.trim() && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              Loading users...
            </div>
          ) : suggestions.length > 0 ? (
            <ul className="py-1">
              {suggestions.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(user)}
                    className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-3 transition-colors"
                  >
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{user.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 text-sm text-muted-foreground text-center">
              No users found matching "{searchQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
