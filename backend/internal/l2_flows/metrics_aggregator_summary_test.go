package l2_flows

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestAggregateSummaryMetricsIncludesCacheHitRate(t *testing.T) {
	db, sqlDB, mock := newSummaryMockDB(t)
	t.Cleanup(func() { _ = sqlDB.Close() })

	mock.ExpectQuery(`SELECT COALESCE\(SUM\(total_cost\), 0\) FROM "usage_logs"`).
		WillReturnRows(sqlmock.NewRows([]string{"total_cost"}).AddRow(12.5))
	mock.ExpectQuery(`SELECT COALESCE\(SUM\(total_cost\), 0\) FROM "usage_logs" WHERE created_at >= \$1`).
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"hourly_cost"}).AddRow(1.5))
	mock.ExpectQuery(`SELECT COALESCE\(SUM\(input_tokens \+ output_tokens\), 0\) AS total_tokens, .* FROM "usage_logs"`).
		WillReturnRows(sqlmock.NewRows([]string{
			"total_tokens", "cache_read_tokens", "cache_eligible_tokens",
		}).AddRow(900, 600, 800))
	mock.ExpectQuery(`SELECT count\(\*\) FROM "usage_logs"`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(10))

	got, err := AggregateSummaryMetrics(db, l0_axioms.MetricsFilter{IncludeCache: false})
	if err != nil {
		t.Fatalf("AggregateSummaryMetrics returned error: %v", err)
	}
	if got.TotalTokens != 900 || got.CacheHitRate != 75 {
		t.Fatalf("unexpected summary: %+v", got)
	}
	payload, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("marshal summary: %v", err)
	}
	if !bytes.Contains(payload, []byte(`"cacheHitRate":75`)) {
		t.Fatalf("missing cacheHitRate JSON contract: %s", payload)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("SQL expectations were not met: %v", err)
	}
}

func newSummaryMockDB(t *testing.T) (*gorm.DB, *sql.DB, sqlmock.Sqlmock) {
	t.Helper()
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("create sqlmock: %v", err)
	}
	db, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{})
	if err != nil {
		_ = sqlDB.Close()
		t.Fatalf("open gorm: %v", err)
	}
	return db, sqlDB, mock
}
