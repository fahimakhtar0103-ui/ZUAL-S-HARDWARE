# Supabase Integration Plan

This document outlines the strategy for integrating Supabase as the backend for the Hardware ERP application. It covers Authentication, Database (with Row Level Security), Storage, and Backups, along with the Flutter integration code as requested.

## 1. Setup Steps

### Step 1: Project Creation
1. Go to the [Supabase Dashboard](https://app.supabase.com/) and click "New Project".
2. Select your organization, name your project (e.g., "Hardware ERP"), and set a strong database password. Choose a region closest to your user base.
3. Once the project is provisioned, go to **Settings > API** to retrieve your `Project URL` and `anon public` key. You will need these for the Flutter integration.

### Step 2: Authentication
1. Go to **Authentication > Providers** in the Supabase Dashboard.
2. Enable Email/Password authentication. (You can disable email confirmations for testing, though it's recommended for production).
3. Optionally, enable Magic Links or OAuth providers (like Google) if needed for quick staff onboarding.

### Step 3: Storage
1. Go to **Storage** and click "New Bucket".
2. Name the bucket `documents` (for PDF invoices, ledgers, and receipts) or `avatars` (for user profiles).
3. Make the bucket **Private** or **Public** depending on your needs. For invoices, keep it private and use authenticated URLs.
4. Set up Storage Policies to allow authenticated users to `SELECT` and `INSERT` files.

### Step 4: Backups
1. Supabase provides automated daily backups for Pro plan users. If you are on the Free plan, you will need to perform manual backups.
2. Go to **Database > Backups** to manage Point-in-Time Recovery (PITR) and daily backups.
3. For custom backups, you can use the `pg_dump` CLI tool provided by Supabase to export your data securely.

---

## 2. SQL Schema with Row Level Security (RLS)

Run this SQL in the Supabase SQL Editor. It creates the tables and sets up Row Level Security (RLS) to ensure users can only access their own data or data they are authorized to see.

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. USERS TABLE (Extending Supabase Auth)
-- ==========================================
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Staff', -- 'Owner', 'Manager', 'Staff'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON users FOR SELECT USING (auth.uid() = id);

-- ==========================================
-- 2. DIARIES (Groups)
-- ==========================================
CREATE TABLE diaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE diaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view diaries" ON diaries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert diaries" ON diaries FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ==========================================
-- 3. CUSTOMERS
-- ==========================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    diary_id UUID NOT NULL REFERENCES diaries(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    credit_limit DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view customers" ON customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert customers" ON customers FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ==========================================
-- 4. TRANSACTIONS (Purchases/Debits)
-- ==========================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    items JSONB, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage transactions" ON transactions FOR ALL USING (auth.role() = 'authenticated');

-- ==========================================
-- 5. PAYMENTS (Credits)
-- ==========================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_mode VARCHAR(50) NOT NULL,
    reference_notes TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage payments" ON payments FOR ALL USING (auth.role() = 'authenticated');

-- ==========================================
-- OUTSTANDING BALANCE CALCULATION VIEW
-- ==========================================
CREATE VIEW view_customer_balances AS
SELECT 
    c.id AS customer_id,
    c.name AS customer_name,
    c.credit_limit,
    COALESCE(t.total_purchases, 0) AS lifetime_purchases,
    COALESCE(p.total_payments, 0) AS lifetime_payments,
    (COALESCE(t.total_purchases, 0) - COALESCE(p.total_payments, 0)) AS outstanding_balance
FROM 
    customers c
LEFT JOIN (
    SELECT customer_id, SUM(total_amount) AS total_purchases 
    FROM transactions 
    GROUP BY customer_id
) t ON c.id = t.customer_id
LEFT JOIN (
    SELECT customer_id, SUM(amount) AS total_payments 
    FROM payments 
    GROUP BY customer_id
) p ON c.id = p.customer_id;
```

---

## 3. Flutter Integration Code

First, add the Supabase package to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  supabase_flutter: ^2.4.0
```

### Main Initialization (`main.dart`)
```dart
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Supabase.initialize(
    url: 'YOUR_SUPABASE_URL',
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
  );

  runApp(const MyApp());
}

final supabase = Supabase.instance.client;

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Hardware ERP',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: const AuthWrapper(),
    );
  }
}
```

### Authentication Service (`auth_service.dart`)
```dart
class AuthService {
  // Sign in using email and password
  Future<AuthResponse> signInEmailPassword(String email, String password) async {
    return await supabase.auth.signInWithPassword(
      email: email, 
      password: password,
    );
  }

  // Sign out
  Future<void> signOut() async {
    await supabase.auth.signOut();
  }

  // Get current user
  User? getCurrentUser() {
    return supabase.auth.currentUser;
  }
}
```

### Database Operations (`database_service.dart`)
```dart
class DatabaseService {
  
  // 1. Fetch Customers with Balances
  Future<List<Map<String, dynamic>>> getCustomersWithBalances() async {
    final data = await supabase
        .from('view_customer_balances')
        .select('*')
        .order('customer_name', ascending: true);
    return List<Map<String, dynamic>>.from(data);
  }

  // 2. Insert a new Payment
  Future<void> recordPayment({
    required String customerId,
    required double amount,
    required String paymentMode,
    String? referenceNotes,
  }) async {
    final userId = supabase.auth.currentUser?.id;
    if (userId == null) throw Exception("User not authenticated");

    await supabase.from('payments').insert({
      'customer_id': customerId,
      'recorded_by': userId,
      'amount': amount,
      'payment_mode': paymentMode,
      'reference_notes': referenceNotes,
      'date': DateTime.now().toIso8601String(),
    });
  }

  // 3. Upload a Document (Storage)
  Future<String> uploadInvoicePdf(String filePath, String fileName) async {
    final file = File(filePath);
    await supabase.storage
        .from('documents')
        .upload('invoices/$fileName', file);
        
    final publicUrl = supabase.storage
        .from('documents')
        .getPublicUrl('invoices/$fileName');
        
    return publicUrl;
  }
}
```
