# 排行榜 MySQL 表

服务端会在启动并首次访问排行榜接口时自动执行 `CREATE TABLE IF NOT EXISTS`。如果云数据库账号没有建表权限，可在 DMC 手动执行下面 SQL。

## 环境变量

| 变量 | 默认值 |
| --- | --- |
| `MYSQL_HOST` | `10.3.106.236` |
| `MYSQL_PORT` | `3306` |
| `MYSQL_DATABASE` | `dots_game` |
| `MYSQL_USER` | `root` |
| `MYSQL_PASSWORD` | 无，未配置时服务端使用内存 fallback |
| `MYSQL_LEADERBOARD_TABLE` | `inferno_3x3_leaderboard` |
| `MYSQL_LEADERBOARD_TABLE_6X6` | `inferno_6x6_leaderboard` |
| `MYSQL_CHALLENGE_LEADERBOARD_TABLE` | `challenge_leaderboard` |

## 炼狱 3x3 / 6x6 表

3x3 和 6x6 使用相同结构，表名分别为 `inferno_3x3_leaderboard`、`inferno_6x6_leaderboard`。

```sql
CREATE TABLE IF NOT EXISTS inferno_6x6_leaderboard (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id VARCHAR(80) NOT NULL,
  nickname VARCHAR(24) NOT NULL DEFAULT '玩家',
  pending_failures INT UNSIGNED NOT NULL DEFAULT 0,
  has_cleared TINYINT(1) NOT NULL DEFAULT 0,
  failures_before_clear INT UNSIGNED NOT NULL DEFAULT 0,
  cleared_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at BIGINT UNSIGNED NOT NULL,
  updated_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_player_id (player_id),
  KEY idx_rank (has_cleared, failures_before_clear, cleared_at),
  KEY idx_updated_at (updated_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
```

如果 3x3 表尚未创建，把表名改成 `inferno_3x3_leaderboard` 再执行一次。

排序规则：

```sql
SELECT player_id, nickname, failures_before_clear, cleared_at
FROM inferno_6x6_leaderboard
WHERE has_cleared = 1
ORDER BY failures_before_clear ASC, cleared_at ASC
LIMIT 20;
```

## 闯关排行榜表

```sql
CREATE TABLE IF NOT EXISTS challenge_leaderboard (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  player_id VARCHAR(80) NOT NULL,
  nickname VARCHAR(24) NOT NULL DEFAULT '玩家',
  best_level INT UNSIGNED NOT NULL DEFAULT 0,
  best_score INT UNSIGNED NOT NULL DEFAULT 0,
  cleared_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at BIGINT UNSIGNED NOT NULL,
  updated_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_player_id (player_id),
  KEY idx_rank (best_level, best_score, cleared_at),
  KEY idx_updated_at (updated_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
```

排序规则：

```sql
SELECT player_id, nickname, best_level, best_score, cleared_at
FROM challenge_leaderboard
WHERE best_level > 0
ORDER BY best_level DESC, best_score DESC, cleared_at ASC
LIMIT 20;
```

## 接口

- `GET /api/leaderboard/inferno-3x3?limit=20`
- `POST /api/leaderboard/inferno-3x3/result`
- `GET /api/leaderboard/inferno-6x6?limit=20`
- `POST /api/leaderboard/inferno-6x6/result`
- `GET /api/leaderboard/challenge?limit=20`
- `POST /api/leaderboard/challenge/result`
