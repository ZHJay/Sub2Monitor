package l1_blocks

import (
	"database/sql"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestGetTokenSummaryHonorsCacheToggleAndUserScope(t *testing.T) {
	cases := []struct {
		name       string
		cache      bool
		totalToken string
	}{
		{name: "with cache", cache: true, totalToken: l0_axioms.TokenTotalSQL},
		{name: "without cache", cache: false, totalToken: l0_axioms.TokenNoCacheSQL},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			db, sqlDB, mock := newTokenSummaryMockDB(t)
			t.Cleanup(func() { _ = sqlDB.Close() })

			selectSQL := "COALESCE(SUM" + testCase.totalToken + ", 0) AS total_tokens, " +
				"COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens, " +
				"COALESCE(SUM(input_tokens + cache_creation_tokens + cache_read_tokens), 0) AS cache_eligible_tokens"
			querySQL := regexp.QuoteMeta(`SELECT ` + selectSQL + ` FROM "usage_logs" WHERE user_id = $1`)
			mock.ExpectQuery(querySQL).
				WithArgs(int64(3)).
				WillReturnRows(sqlmock.NewRows([]string{
					"total_tokens", "cache_read_tokens", "cache_eligible_tokens",
				}).AddRow(900, 600, 800))

			got, err := GetTokenSummary(db, l0_axioms.MetricsFilter{IncludeCache: testCase.cache}, 3)
			if err != nil {
				t.Fatalf("GetTokenSummary returned error: %v", err)
			}
			want := l0_axioms.TokenSummary{TotalTokens: 900, CacheReadTokens: 600, CacheEligibleTokens: 800}
			if got != want {
				t.Fatalf("got %+v, want %+v", got, want)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("SQL expectations were not met: %v", err)
			}
		})
	}
}

func newTokenSummaryMockDB(t *testing.T) (*gorm.DB, *sql.DB, sqlmock.Sqlmock) {
	t.Helper()
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("create sqlmock: %v", err)
	}
	db, err := gorm.Open(postgres.New(postgres.Config{
		Conn: sqlDB,
	}), &gorm.Config{})
	if err != nil {
		_ = sqlDB.Close()
		t.Fatalf("open gorm: %v", err)
	}
	return db, sqlDB, mock
}
