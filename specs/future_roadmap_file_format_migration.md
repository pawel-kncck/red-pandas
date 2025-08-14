# Storage Migration Strategy: JSON → CSV → Parquet

## Quick Reference Guide for Analytics App Storage Evolution

### Overview

This document captures our storage migration strategy for the LLM analytics application, outlining when and how to migrate from simple JSON storage to CSV files, and eventually to Parquet format.

---

## The Three Storage Formats

### 1. JSON (JavaScript Object Notation)

**What it is:** Text-based format storing data as key-value pairs in MongoDB documents.

**How it's stored:**

```json
{"name": "John", "age": 30, "salary": 70000}
{"name": "Jane", "age": 25, "salary": 65000}
```

### 2. CSV (Comma-Separated Values)

**What it is:** Plain text file with rows of data, columns separated by commas.

**How it's stored:**

```csv
name,age,salary
John,30,70000
Jane,25,65000
```

### 3. Parquet (Apache Parquet)

**What it is:** Binary columnar storage format optimized for analytics.

**How it's stored:**

```
[Column-based storage]
names: [John, Jane, Bob, Alice]
ages: [30, 25, 35, 28]
salaries: [70000, 65000, 80000, 72000]
```

---

## Performance Comparison

### Storage Size (1M rows, 10 columns)

- **JSON**: ~450 MB (3x overhead due to key repetition)
- **CSV**: ~150 MB (baseline)
- **Parquet**: ~30 MB (80% compression)

### Read Speed (1M rows)

- **JSON**: 12.3 seconds (parsing overhead)
- **CSV**: 4.8 seconds (full file scan)
- **Parquet**: 0.9 seconds (binary format + compression)

### Query Specific Columns (3 of 50 columns)

- **JSON**: 12.3 seconds (must parse entire document)
- **CSV**: 4.8 seconds (must read entire file)
- **Parquet**: 0.12 seconds (reads only needed columns!)

---

## Why Parquet Is So Much Smaller

### 1. **Dictionary Encoding**

Instead of storing "Electronics" 100,000 times, Parquet stores:

- Dictionary: `{0: "Electronics", 1: "Clothing", 2: "Food"}`
- Data: `[0, 0, 1, 2, 0, 1, ...]` (just numbers!)

### 2. **Run-Length Encoding**

Consecutive repeated values are compressed:

- Original: `[5, 5, 5, 5, 5, 3, 3, 3]`
- Compressed: `[(5, 5 times), (3, 3 times)]`

### 3. **Bit Packing**

If numbers only range 0-100, Parquet uses 7 bits instead of 64 bits per number.

### 4. **Column Compression**

Similar values in a column compress better than mixed data in rows.

---

## Pros and Cons Summary

### JSON in MongoDB

**✅ Pros:**

- Single storage system (simple!)
- No sync issues
- Atomic operations
- Fast development
- Easy debugging

**❌ Cons:**

- 16MB document limit (~100k rows)
- 3x storage overhead
- Expensive at scale
- Memory intensive
- Network transfer overhead

### CSV File Storage

**✅ Pros:**

- No size limits
- Human readable
- Universal compatibility
- Efficient storage
- Streaming possible

**❌ Cons:**

- Two storage systems (files + MongoDB)
- Sync complexity
- No type preservation
- Must read entire file
- No compression

### Parquet Storage

**✅ Pros:**

- 80-90% compression
- Columnar queries (read only what you need)
- Type preservation
- Built-in metadata
- Optimized for analytics

**❌ Cons:**

- Not human readable
- Requires conversion from CSV
- Schema strictness
- More complex setup
- Needs specialized libraries

---

## Migration Guidelines

### Phase 1: Start with JSON (MVP)

**Technical Implementation:**

```python
# Simple JSON storage - get to market fast
MAX_ROWS = 10_000  # Document size limit

session_data = {
    "_id": session_id,
    "full_data": df.to_dict('records'),  # JSON in MongoDB
    "row_count": len(df)
}
```

**Stay with JSON while:**

- ✓ Average file size <1MB
- ✓ Max file size <5MB
- ✓ User count <100
- ✓ Total storage <10GB
- ✓ No timeout issues

### Phase 2: Migrate to CSV

**Migration Triggers (if ANY are true):**

- 🚨 Users uploading >10k row files
- 🚨 MongoDB storage >50GB
- 🚨 Document size limit errors
- 🚨 Memory issues with concurrent users
- 🚨 Storage costs >$100/month

**Technical Implementation:**

```python
# Hybrid approach
if len(df) < 5000:  # Small files
    storage_type = "json"
    data = df.to_dict('records')
else:  # Large files
    storage_type = "csv"
    path = f"/data/{session_id}.csv"
    df.to_csv(path)
```

**Product Indicators:**

- Users complaining about file size limits
- Need for files >100k rows
- Multiple users analyzing simultaneously
- Cost becoming a concern

### Phase 3: Add Parquet Support

**Migration Triggers (if ANY are true):**

- 🚨 Storage >500GB
- 🚨 Query performance <2 seconds expected
- 🚨 Columnar queries common (analyzing specific fields)
- 🚨 Files regularly >100MB
- 🚨 Cloud storage costs >$500/month

**Technical Implementation:**

```python
# Store both CSV (original) and Parquet (optimized)
df.to_csv(f"{session_id}/original.csv")  # Keep original
df.to_parquet(f"{session_id}/optimized.parquet", compression='snappy')

# Query optimization
if query_needs_all_columns:
    df = pd.read_csv(csv_path)
else:
    df = pd.read_parquet(parquet_path, columns=needed_columns)
```

**Product Indicators:**

- Enterprise customers
- Real-time analytics requirements
- Large-scale data processing (>1M rows)
- Complex aggregations common
- Cost optimization priority

---

## Migration Decision Framework

```python
def should_migrate():
    """Check if migration is justified"""

    metrics = get_current_metrics()

    # JSON → CSV Migration
    if any([
        metrics.avg_file_size_mb > 5,
        metrics.max_file_size_mb > 15,
        metrics.document_size_errors > 0,
        metrics.monthly_storage_cost > 100,
        metrics.user_complaints_about_limits > 5
    ]):
        return "MIGRATE_TO_CSV"

    # CSV → Parquet Migration
    if any([
        metrics.total_storage_gb > 500,
        metrics.avg_query_time_seconds > 5,
        metrics.columnar_query_percentage > 50,
        metrics.monthly_storage_cost > 500,
        metrics.enterprise_customers > 0
    ]):
        return "ADD_PARQUET_SUPPORT"

    return "KEEP_CURRENT"
```

---

## Key Takeaways

1. **Start Simple**: JSON in MongoDB is perfect for MVP. Don't over-engineer.

2. **Monitor Usage**: Track file sizes, query patterns, and costs to know when to migrate.

3. **Migrate When Necessary**: Each format has its place. Migrate when you hit real limitations, not theoretical ones.

4. **Abstract Storage Layer**: Design code to make migration easier:

   ```python
   class StorageAdapter:
       async def store(self, df): pass
       async def load(self, session_id): pass
   ```

5. **Keep Original Files**: When you do migrate, keep CSV originals for data integrity and user trust.

6. **Performance Targets**:
   - MVP: <5 second response time acceptable
   - Growth: <2 second response time expected
   - Scale: <500ms for common queries

---

## Remember

**The best storage format is the one that ships.** Start with JSON, get users, learn from usage, then optimize. Premature optimization is the root of all evil, especially in MVPs.

Migration complexity: JSON (1 day) → CSV (1 week) → Parquet (2 weeks)

Each migration adds complexity but enables 10x scale. Only migrate when you need that scale!
