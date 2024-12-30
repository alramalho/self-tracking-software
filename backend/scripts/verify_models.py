import asyncio
import psycopg2.extras
from tortoise import fields, Tortoise
from dotenv import load_dotenv
import os
from db.config import TORTOISE_ORM
from entities.models import (
    User, Plan, Activity, ActivityEntry, Notification,
    Message, PlanGroup, PlanGroupMember, FriendRequest, PlanInvitation
)

def get_table_info(table_name: str, cursor) -> list:
    """Get column information for a specific table"""
    # First, verify the table exists in public schema
    check_table = """
    SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public' 
        AND tablename = %s
    );
    """
    cursor.execute(check_table, (table_name,))
    if not cursor.fetchone()[0]:
        return []

    # Get the actual column information from the table
    query = """
    SELECT column_name, data_type, udt_name, 
           is_nullable, column_default,
           character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = %s
    ORDER BY ordinal_position;
    """
    cursor.execute(query, (table_name,))
    return cursor.fetchall()

def verify_model(model_cls, cursor):
    """Verify a single model against the database schema"""
    table_name = model_cls._meta.db_table
    print(f"\nVerifying {table_name}...")
    
    # Get actual database schema
    columns = get_table_info(table_name, cursor)
    if not columns:
        print(f"❌ Table {table_name} does not exist in public schema!")
        return
    
    # Create a map of actual columns
    db_columns = {col['column_name']: col for col in columns}

    print(f"Columns: {db_columns.keys()}")
    
    # Check each field in our model
    for field_name, field in model_cls._meta.fields_map.items():
        if field_name not in db_columns:
            print(f"❌ Field {field_name} exists in model but not in database")
            continue
            
        db_col = db_columns[field_name]
        db_type = db_col['data_type']
        udt_type = db_col['udt_name']  # This gives us the underlying type
        
        # Print detailed type information
        print(f"Field '{field_name}':")
        print(f"  - Model type: {field.__class__.__name__}")
        print(f"  - DB type: {db_type}")
        print(f"  - UDT type: {udt_type}")
        print(f"  - Nullable: {db_col['is_nullable']}")
        if db_col['character_maximum_length']:
            print(f"  - Max length: {db_col['character_maximum_length']}")
        
        # Basic type checking (can be expanded)
        expected_type = None
        if isinstance(field, fields.CharField):
            expected_type = "character varying"
        elif isinstance(field, fields.TextField):
            expected_type = "text"
        elif isinstance(field, fields.IntField):
            expected_type = "integer"
        elif isinstance(field, fields.BooleanField):
            expected_type = "boolean"
        elif isinstance(field, fields.JSONField):
            expected_type = "jsonb"
        elif isinstance(field, fields.DatetimeField):
            expected_type = "timestamp with time zone"
        
        if expected_type and db_type != expected_type:
            print(f"  ❌ Type mismatch!")
        else:
            print(f"  ✅ Types match")
            
    # Check for extra columns in database
    model_fields = set(f.replace("_id", "id") if f == "_id" else f for f in model_cls._meta.fields_map.keys())
    db_fields = set(db_columns.keys())
    extra_fields = db_fields - model_fields
    if extra_fields:
        print(f"\nℹ️ Extra fields in database:")
        for field in extra_fields:
            col = db_columns[field]
            print(f"  - {field}: {col['data_type']} (nullable: {col['is_nullable']})")

    print(f"\n✅ Finished verifying {table_name}")

def verify_data_sample(model_cls, cursor):
    """Verify we can read a sample of data"""
    table_name = model_cls._meta.db_table  # Changed from table to db_table
    print(f"\nTesting data access for {table_name}...")
    
    try:
        # Try to read first row using raw SQL
        cursor.execute(f'SELECT * FROM {table_name} LIMIT 1')
        row = cursor.fetchone()
        if row:
            print(f"✅ Found record in {table_name}")
            print(f"Sample data: {dict(row)}")
        else:
            print(f"ℹ️ No data found in {table_name}")
    except Exception as e:
        print(f"❌ Error reading from {table_name}: {str(e)}")

async def init_tortoise():
    """Initialize Tortoise ORM"""
    await Tortoise.init(config=TORTOISE_ORM)

def main():
    # Load environment variables
    load_dotenv()
    
    # Get database URL from Tortoise config
    db_url = TORTOISE_ORM["connections"]["default"]
    
    # Parse connection parameters from URL
    from urllib.parse import urlparse
    url = urlparse(db_url)
    db_params = {
        "user": url.username,
        "password": url.password,
        "host": url.hostname,
        "port": url.port,
        "dbname": url.path[1:]  # Remove leading slash
    }
    
    print("Connecting to database...")
    
    try:
        # Initialize Tortoise ORM
        asyncio.run(init_tortoise())
        
        # Connect to database
        conn = psycopg2.connect(**db_params)
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        print("✅ Connected successfully!")
        
        # Models to verify
        models = [
            User, Plan, Activity, ActivityEntry, Notification,
            Message, PlanGroup, PlanGroupMember, FriendRequest, PlanInvitation
        ]
        
        # Verify schema for each model
        for model in models:
            verify_model(model, cursor)
            verify_data_sample(model, cursor)
        
        # Close connections
        cursor.close()
        conn.close()
        print("\n✅ Verification complete!")
        
    except Exception as e:
        print(f"❌ Failed to connect or verify: {str(e)}")
    finally:
        # Close Tortoise
        asyncio.run(Tortoise.close_connections())

if __name__ == "__main__":
    main() 