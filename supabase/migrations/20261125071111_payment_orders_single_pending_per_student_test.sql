-- Prevent concurrent or repeated checkout requests from creating
-- multiple open payment orders for one student and one mock test.
CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_one_pending_per_student_test
ON public.payment_orders (student_id, mock_test_id)
WHERE status = 'pending';
