# Plant Arena - Guía y Reglas del Proyecto para Antigravity

Este documento es cargado automáticamente por Antigravity en cada conversación y define las capacidades, permisos y arquitectura del proyecto.

---

## 🗄️ Acceso y Consultas a la Base de Datos (Supabase PostgreSQL)

El asistente tiene **permiso explícito y autorización directa** para consultar la base de datos de producción y aplicar correcciones o diagnósticos cuando el usuario lo solicite.

### Utilidad CLI para Consultas
Se dispone de la herramienta `scripts/db.mjs` configurada para ejecutar consultas directas a través del connection pooler de Supabase:

```bash
# Consultar datos en vivo
node scripts/db.mjs "SELECT id, username, elo_rating, gold_balance, gems_balance FROM profiles LIMIT 5;"

# Ejecutar o verificar una migración SQL
node scripts/db.mjs -f supabase/migrations/149-fix-referral-gold-claim.sql
```

### Configuración de Conexión
- Las credenciales están en `.env` (archivo ignorado por git):
  - `DATABASE_URL`: `postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres` (Puerto 5432 para DDL y transacciones, región `ca-central-1`).
- La biblioteca `pg` está disponible en el entorno Node.js.

---

## 👥 Sistema de Referidos

- **Criterio de Amigo Válido**: Un jugador referido cuenta como válido en cuanto alcanza **1,100 copas** (`elo_rating >= 1100`).
- **Recompensas Permanentes**:
  - **100 Oro**: Por cada amigo válido que alcance 1,100 copas (`claim_referral_gold`).
  - **5% Comisión**: En gemas de cada depósito de los referidos (`claim_referral_deposit_gems`).
- **Metas de Temporada (15 días)**:
  - 10 amigos válidos: 1 Sobre Básico (`claim_referral_season_milestone('sobre_10')`).
  - 35 amigos válidos: 500 Gemas (`claim_referral_season_milestone('gemas_35')`).
- **Ranking de Temporada**: Top 1 al 5 reciben premios automáticos al cierre de temporada (`_cerrar_temporada_de_referidos()`).
