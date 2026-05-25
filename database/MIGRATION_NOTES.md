# Database Migration & Maintenance Notes

## Current Status

### Schema Management
- **Source of Truth**: `backend/db.js` - Contains `ensureDatabaseSchema()` function
- **Auto-initialization**: Runs automatically on server startup
- **Status**: ✅ Active and in use

### Migration Files (Legacy/Reference)
These files are kept for historical reference but are NOT used by the active system:

- `database/migrate.sql` - Manual migration SQL (reference only)
- `database/run_migration.js` - Standalone migration script (legacy)
- `database/additon.sql` - Example queries and reference documentation
- `backend/migrate.js` - Older programmatic migration (not used)

## Maintenance Tasks

### Upload Cleanup (Recommended)
To find and remove orphaned profile images:

```sql
-- Find referenced images
SELECT DISTINCT profile_image FROM profiles WHERE profile_image IS NOT NULL AND profile_image != '';

-- Compare against filesystem at: backend/uploads/
-- Delete any files not in the above list
```

### Current Uploads
- **Location**: `backend/uploads/`
- **Size**: ~7.2 MB
- **Count**: 14 files
- **Recommendation**: Run audit query above to identify orphaned images

## Setup Instructions for New Developers

1. Start the backend server: `npm start` in `backend/`
2. Server automatically creates/updates schema via `db.js`
3. No manual migration needed unless using legacy SQL files

## Troubleshooting

If schema is out of sync:
- Check `backend/db.js` `ensureDatabaseSchema()` function
- Ensure MySQL connection is working: `npm start` will report errors
- For manual fixes, use `database/migrate.sql` as reference

---
*Last updated: 2025-05-24*
