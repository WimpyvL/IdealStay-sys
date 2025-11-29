-- Fix property ratings by recalculating from existing reviews
-- Run this script to sync property ratings with existing reviews

UPDATE properties p
SET
    average_rating = (
        SELECT COALESCE(AVG(r.rating), 0.00)
        FROM reviews r
        WHERE r.property_id = p.id AND r.review_type = 'property'
    ),
    total_reviews = (
        SELECT COUNT(*)
        FROM reviews r
        WHERE r.property_id = p.id AND r.review_type = 'property'
    );

-- Verify the update
SELECT
    p.id,
    p.title,
    p.average_rating,
    p.total_reviews,
    COUNT(r.id) as actual_review_count,
    AVG(r.rating) as actual_avg_rating
FROM properties p
LEFT JOIN reviews r ON r.property_id = p.id AND r.review_type = 'property'
GROUP BY p.id, p.title, p.average_rating, p.total_reviews
HAVING COUNT(r.id) > 0
ORDER BY p.id;
