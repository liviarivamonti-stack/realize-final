import psycopg2
import os

db_url = "postgresql://postgres:@12DEJUNHO@db.hcolufjlzcrnppvlihvs.supabase.co:5432/postgres"

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # SQL para criar as tabelas básicas necessárias para o login/cadastro
    sql = """
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha_hash TEXT NOT NULL,
        papel TEXT DEFAULT 'vendedor',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        created_by INTEGER REFERENCES users(id),
        invite_code TEXT UNIQUE NOT NULL,
        meta_mensal NUMERIC DEFAULT 20000,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS team_members (
        user_id INTEGER REFERENCES users(id),
        team_id INTEGER REFERENCES teams(id),
        role TEXT DEFAULT 'vendedor',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (user_id, team_id)
    );

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
    conn.commit()
    print("Tabelas criadas com sucesso!")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Erro ao conectar ou criar tabelas: {e}")
