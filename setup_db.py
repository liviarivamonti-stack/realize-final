import psycopg2
import time

# Usando a URL do Pooler que o usuário forneceu
db_url = "postgresql://postgres.hcolufjlzcrnppvlihvs:%2512DEJUNHO123@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

def setup():
    try:
        print("Conectando ao Supabase...")
        conn = psycopg2.connect(
            host="aws-1-us-east-1.pooler.supabase.com",
            port=6543,
            user="postgres.hcolufjlzcrnppvlihvs",
            password="%12DEJUNHO123",
            database="postgres"
        )
        conn.autocommit = True
        cur = conn.cursor()
        
        print("Criando tabelas...")
        sql = """
        -- Tabela de Usuários
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha_hash TEXT NOT NULL,
            papel TEXT DEFAULT 'vendedor',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Tabela de Times
        CREATE TABLE IF NOT EXISTS teams (
            id SERIAL PRIMARY KEY,
            nome TEXT NOT NULL,
            created_by INTEGER REFERENCES users(id),
            invite_code TEXT UNIQUE NOT NULL,
            meta_mensal NUMERIC DEFAULT 20000,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Tabela de Membros de Time
        CREATE TABLE IF NOT EXISTS team_members (
            user_id INTEGER REFERENCES users(id),
            team_id INTEGER REFERENCES teams(id),
            role TEXT DEFAULT 'vendedor',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            PRIMARY KEY (user_id, team_id)
        );

        -- Tabela de Sessões (opcional se usar JWT, mas bom ter)
        CREATE TABLE IF NOT EXISTS sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            active_team_id INTEGER REFERENCES teams(id),
            token TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """
        
        cur.execute(sql)
        print("Tabelas criadas ou já existentes!")
        
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Erro ao configurar banco: {e}")
        return False

if __name__ == "__main__":
    setup()
