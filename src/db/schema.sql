-- ==========================================
-- HARDWARE ERP DATABASE ARCHITECTURE
-- ==========================================

-- 1. USERS TABLE
-- Manages shop owners, managers, and staff access
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL, -- e.g., 'Owner', 'Manager', 'Staff'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. DIARIES TABLE
-- Used to group customers together (e.g., "Zone A", "2024 Active Accounts")
CREATE TABLE diaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. CUSTOMERS TABLE
-- Stores details for hardware shop buyers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diary_id UUID NOT NULL REFERENCES diaries(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    credit_limit DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TRANSACTIONS TABLE
-- Records purchases/billing (Debits to customer account)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    items JSONB, -- Stores array of invoice items: [{material: 'Sand', qty: 1, rate: 7000}]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. PAYMENTS TABLE
-- Records collections/receipts (Credits to customer account)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_mode VARCHAR(50) NOT NULL, -- 'Cash', 'UPI', 'Bank Transfer', 'Cheque'
    reference_notes TEXT, -- Transaction IDs, Cheque numbers, etc.
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- OUTSTANDING BALANCE CALCULATION
-- ==========================================

-- Creates a dynamic view to calculate outstanding balances in real-time
CREATE VIEW view_customer_balances AS
SELECT 
    c.id AS customer_id,
    c.name AS customer_name,
    c.credit_limit,
    COALESCE(t.total_purchases, 0) AS lifetime_purchases,
    COALESCE(p.total_payments, 0) AS lifetime_payments,
    (COALESCE(t.total_purchases, 0) - COALESCE(p.total_payments, 0)) AS outstanding_balance,
    CASE 
        WHEN (COALESCE(t.total_purchases, 0) - COALESCE(p.total_payments, 0)) > c.credit_limit AND c.credit_limit > 0 THEN 'OVER_LIMIT'
        WHEN (COALESCE(t.total_purchases, 0) - COALESCE(p.total_payments, 0)) > 0 THEN 'DUE'
        ELSE 'CLEARED'
    END as status
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
