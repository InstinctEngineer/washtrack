# Multi-Client Architecture

## Business Model Overview

WashTrack operates under a **multi-client service model** where:

- The wash company operates multiple physical wash facility locations
- **Each location services vehicles from MULTIPLE client companies** (trucking companies, fleet operators, construction companies, etc.)
- A single location can service 10+ different clients simultaneously
- Each client has their own vehicle fleet with custom rates and billing terms
- Employees work at locations and can wash vehicles for any client serviced there
- **Billing is generated PER CLIENT**, not per location

## Data Model Architecture

### Core Tables

#### 1. **clients** - Client Companies
Primary table storing all client company information:

**Key Fields:**
- `client_code`: Unique identifier (e.g., "ABC123")
- `client_name`: Display name
- `legal_business_name`: Legal entity name for contracts
- `industry`: Type of business (trucking, construction, etc.)
- Contact information (primary, billing)
- Billing address
- `payment_terms`: Net 30, Net 60, etc.
- `account_status`: active, suspended, past_due, collections, inactive
- `invoice_frequency`: weekly, monthly, quarterly, per_wash
- Contract details and custom discount percentage

**Status Management:**
- `is_active`: Active/inactive flag
- `account_status`: Business relationship status
- Soft delete support with `deleted_at`/`deleted_by`

#### 2. **client_locations** - Junction Table
Maps which clients are serviced at which locations (many-to-many):

**Key Fields:**
- `client_id`: Reference to client
- `location_id`: Reference to location
- `is_primary_location`: Client's main servicing location
- `priority_level`: low, standard, high, vip
- `rate_multiplier`: Location-specific rate adjustment (1.0 = standard)
- `is_active`: Whether client is currently serviced at this location

**Example Scenario:**
```
ABC Trucking (client_id: abc-123) is serviced at:
  - Location A (primary, rate_multiplier: 1.0)
  - Location B (secondary, rate_multiplier: 1.2)
  - Location C (inactive, was serviced previously)
```

#### 3. **client_vehicle_rates** - Custom Pricing
Client-specific pricing for different vehicle types:

**Key Fields:**
- `client_id`: Which client
- `vehicle_type_id`: Which vehicle type
- `custom_rate`: Overridden rate (instead of base rate)
- `effective_date`: When this rate starts
- `expiration_date`: When this rate ends (nullable)

**Example:**
```
ABC Trucking pays:
  - $50 for Semi Trucks (effective 2024-01-01)
  - $25 for Box Trucks (effective 2024-01-01)
  
Standard rates might be $60 and $30, but ABC has negotiated rates.
```

#### 4. **client_contacts** - Multiple Contacts Per Client
Stores various contacts for each client:

**Contact Types:**
- primary: Main point of contact
- billing: Accounts payable contact
- operations: Day-to-day operations
- emergency: After-hours contact
- other: Any other contact type

#### 5. **client_notes** - Communication Log
Historical record of client interactions:

**Note Types:**
- general, billing, complaint, compliment, contract, important
- `is_pinned`: Pin important notes to top
- Tracks who created note and when

### Modified Existing Tables

#### **vehicles** (Modified)
Vehicles now belong to clients, not just locations:

**New Fields:**
- `client_id`: **REQUIRED** - Which client owns this vehicle
- `client_vehicle_number`: Client's internal numbering system
- `home_location_id`: Where vehicle is normally located (for convenience)

**Access Pattern:**
```sql
-- Find all vehicles for a specific client
SELECT * FROM vehicles WHERE client_id = 'abc-123';

-- Find all vehicles for clients serviced at Location A
SELECT v.* FROM vehicles v
JOIN client_locations cl ON cl.client_id = v.client_id
WHERE cl.location_id = 'location-a' AND cl.is_active = TRUE;
```

#### **wash_entries** (Modified)
Wash entries now track which client the wash is for:

**New Fields:**
- `client_id`: **REQUIRED** - Denormalized for query performance
- Links to vehicle via `vehicle_id`, but also stores `client_id` directly

**Why Denormalize client_id?**
- Faster billing queries (don't need to join through vehicles table)
- Historical accuracy (if vehicle changes clients, old entries stay correct)
- Query optimization for monthly billing reports

#### **users** (Modified)
Users can have restricted client access:

**New Fields:**
- `assigned_clients`: Array of client IDs this user manages (for account managers)
- `client_access_level`:
  - `all`: Can see all clients (admins, finance)
  - `assigned_only`: Can only see assigned clients (account managers)
  - `location_only`: Can only see clients at their location (employees)

#### **locations** (Modified)
Locations track how many clients they service:

**New Fields:**
- `max_clients_serviced`: Capacity planning (default 20)
- `current_clients_count`: How many active clients at this location

## Access Control & RLS Policies

### Client Visibility Rules

**Admins & Finance:**
- Can see ALL clients
- Can manage all client data
- Can view all wash entries for all clients

**Managers:**
- Can see clients at locations they manage
- Can view wash entries for their location's clients

**Employees:**
- Can ONLY see clients serviced at their assigned location
- Can ONLY add wash entries for vehicles belonging to those clients
- Cannot see clients at other locations

**Implementation:**
```sql
-- RLS Policy: Employees can only see clients at their location
CREATE POLICY "Employees can view clients at their location"
ON clients FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN client_locations cl ON cl.location_id = u.location_id
    WHERE u.id = auth.uid()
    AND cl.client_id = clients.id
    AND cl.is_active = TRUE
  )
);
```

### Data Isolation

**Key Principle:** Employees at Location A cannot see or interact with clients serviced only at Location B.

**Example:**
```
Location A services: ABC Trucking, XYZ Construction
Location B services: DEF Logistics, GHI Rentals
Location C services: ABC Trucking (also), JKL Transport

Employee at Location A can see:
  - ABC Trucking vehicles
  - XYZ Construction vehicles
  
Employee at Location C can see:
  - ABC Trucking vehicles (shared client!)
  - JKL Transport vehicles

Employee at Location B can see:
  - DEF Logistics vehicles
  - GHI Rentals vehicles
```

## Billing Model

### Per-Client Invoicing

**Monthly Billing Process:**
1. Query all wash_entries for `client_id` in date range
2. Calculate total washes by vehicle type
3. Apply client-specific rates (from `client_vehicle_rates`) or base rates
4. Apply client's `discount_percentage` and `rate_multiplier` from `client_locations`
5. Generate invoice PDF with client's billing contact info
6. Send to client's `billing_contact_email`

**Invoice Frequency Options:**
- `weekly`: Invoice every week
- `bi_weekly`: Invoice every 2 weeks
- `monthly`: Invoice at month end
- `quarterly`: Invoice every 3 months
- `per_wash`: Invoice immediately after each wash (for certain clients)

**Rate Priority (highest to lowest):**
1. Vehicle-specific `custom_rate` (on vehicles table)
2. Client-vehicle type rate (from `client_vehicle_rates`)
3. Location rate multiplier (from `client_locations`)
4. Base rate (from `vehicle_types`)

### Payment Terms

Clients have configurable payment terms:
- `net_15`: Payment due in 15 days
- `net_30`: Payment due in 30 days (most common)
- `net_45`: Payment due in 45 days
- `net_60`: Payment due in 60 days
- `due_on_receipt`: Payment due immediately
- `prepaid`: Client pays in advance (credit balance)

## Employee Workflow Changes

### Adding a Wash Entry

**Previous Workflow:**
1. Employee selects vehicle
2. System records wash at their location

**New Multi-Client Workflow:**
1. Employee selects vehicle (now filtered by clients at their location)
2. System automatically determines `client_id` from vehicle
3. System validates employee's location services this client
4. System records wash with both `vehicle_id` AND `client_id`

**UI Changes Needed:**
- Vehicle dropdown should show client name with vehicle number
- Example: "ABC-123 (ABC Trucking)" instead of just "ABC-123"
- Optional: Filter/group vehicles by client

### Creating New Vehicles

**When employee creates a new vehicle:**
- Must select which client the vehicle belongs to
- Can only select from clients serviced at their location
- Vehicle automatically gets `home_location_id` set to employee's location
- Vehicle gets `client_id` set to selected client

## Admin Dashboard Changes

### New Required Sections

**1. Client Management:**
- List all clients
- Create/edit/deactivate clients
- View client details (contacts, notes, contracts)
- Manage client status (active, suspended, etc.)

**2. Client-Location Assignment:**
- View which clients are serviced at each location
- Assign clients to locations
- Set location-specific rate multipliers
- Deactivate client at specific location

**3. Client Rates Management:**
- Set client-specific rates for vehicle types
- View rate history (effective dates)
- Set rate expiration dates

**4. Billing Dashboard:**
- Generate per-client invoices
- View outstanding balances
- Track payment status
- Export billing data by client

## Future-Proofing Columns

The migration adds **60+ nullable columns** to existing tables for future expansion. These are NOT implemented in UI yet and should remain unused:

### wash_entries Future Features
- Photo uploads (before/after/damage)
- Time tracking (started/completed/duration)
- Quality ratings and inspections
- Service types (detail, express, deep clean)
- Weather conditions
- Supply tracking (soap/water usage)
- Approval workflows
- Customer satisfaction
- Rework tracking

### users Future Features
- HR data (hire date, certifications, training)
- Performance metrics
- Shift scheduling
- Pay rates and commission
- Security features (2FA, login tracking)
- Profile customization

### vehicles Future Features
- Detailed specifications (make, model, VIN)
- Maintenance tracking
- Condition tracking
- Driver assignment
- Special equipment requirements
- Photo uploads

### locations Future Features
- Operating hours
- Equipment inventory
- Capacity management
- Geographic coordinates
- Performance metrics

**IMPORTANT:** Do not build UI for these features yet. They are placeholders for future development.

## Migration Safety

### Backward Compatibility

The migration is designed to be non-breaking:

1. **All new columns are nullable** - existing data remains valid
2. **Existing functionality unchanged** - current features continue to work
3. **RLS policies are additive** - doesn't remove existing permissions
4. **Indexes improve performance** - no performance degradation

### Data Integrity

**Foreign Keys:**
- `client_id` columns use `ON DELETE SET NULL` for safety
- Client deletion doesn't cascade to vehicles (preserves history)
- Soft delete pattern used (`deleted_at`) instead of hard deletes

**Constraints:**
- Unique constraints prevent duplicate client-location assignments
- Check constraints ensure data validity (enums, ranges)
- NOT NULL only on truly required fields

## Implementation Roadmap

### Phase 1: Database Foundation (COMPLETE)
- ✅ Create clients tables
- ✅ Add client_id to vehicles and wash_entries
- ✅ Create RLS policies
- ✅ Add future-proofing columns

### Phase 2: Basic Client Management (NEXT)
- [ ] Admin UI for client CRUD
- [ ] Client-location assignment UI
- [ ] Update vehicle creation to require client selection
- [ ] Update wash entry to show client context

### Phase 3: Billing Integration
- [ ] Per-client rate management UI
- [ ] Billing export by client
- [ ] Invoice generation
- [ ] Payment tracking

### Phase 4: Advanced Features
- [ ] Client portal (separate access)
- [ ] Automated invoicing
- [ ] Contract management
- [ ] Performance analytics per client

### Phase 5: Future Enhancements
- [ ] Implement photo uploads
- [ ] Add time tracking
- [ ] Build quality inspection system
- [ ] Implement approval workflows
- [ ] Add maintenance tracking

## Database Queries Examples

### Common Queries

**Get all clients at a location:**
```sql
SELECT c.* FROM clients c
JOIN client_locations cl ON cl.client_id = c.id
WHERE cl.location_id = 'location-xyz'
AND cl.is_active = TRUE;
```

**Get all vehicles for a client:**
```sql
SELECT * FROM vehicles
WHERE client_id = 'client-abc'
AND is_active = TRUE;
```

**Monthly billing for a client:**
```sql
SELECT 
  we.wash_date,
  v.vehicle_number,
  vt.type_name,
  COALESCE(
    cvr.custom_rate,
    vt.rate_per_wash * cl.rate_multiplier
  ) as applied_rate
FROM wash_entries we
JOIN vehicles v ON v.id = we.vehicle_id
JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
LEFT JOIN client_vehicle_rates cvr ON 
  cvr.client_id = we.client_id AND 
  cvr.vehicle_type_id = v.vehicle_type_id AND
  we.wash_date >= cvr.effective_date AND
  (cvr.expiration_date IS NULL OR we.wash_date <= cvr.expiration_date)
LEFT JOIN client_locations cl ON 
  cl.client_id = we.client_id AND 
  cl.location_id = we.actual_location_id
WHERE we.client_id = 'client-abc'
AND we.wash_date >= '2024-01-01'
AND we.wash_date <= '2024-01-31';
```

**Employees who can service a specific client:**
```sql
SELECT u.* FROM users u
JOIN client_locations cl ON cl.location_id = u.location_id
WHERE cl.client_id = 'client-abc'
AND cl.is_active = TRUE
AND u.is_active = TRUE;
```

## Key Takeaways

1. **Multi-tenancy within locations**: Each location services multiple clients
2. **Client-based billing**: All financial operations are per-client
3. **Data isolation**: Employees only see clients at their location
4. **Flexible rates**: Base rates + client overrides + location multipliers
5. **Future-proof**: 60+ placeholder columns for expansion
6. **Safe migration**: All changes are nullable and backward-compatible

## Support & Questions

For questions about:
- Client setup process → See `CLIENT_MANAGEMENT_GUIDE.md`
- Billing procedures → See billing dashboard documentation (TBD)
- Technical implementation → See database schema comments
- Access control → See RLS policy definitions in migration
