# FloodGuard - Diagrama do Banco de Dados

## Diagrama de entidades e relacionamentos

```mermaid
erDiagram
    DISPOSITIVO ||--o{ LEITURA : possui

    DISPOSITIVO {
        int id PK
        string device_id UK
        string nome
        string localizacao
        boolean ativo
    }

    LEITURA {
        int id PK
        float altura
        string tendencia
        datetime data
        string status
        int dispositivo_id FK
    }

    USUARIO {
        int id PK
        string nome
        string email UK
        string senha
        string perfil
    }
```

## Descrição das entidades

### Usuario
- `id`: chave primária.
- `nome`: nome do usuário.
- `email`: e-mail único.
- `senha`: senha armazenada com hash.
- `perfil`: perfil de acesso, ADMIN ou OPERADOR.

### Dispositivo
- `id`: chave primária.
- `device_id`: identificador único do dispositivo.
- `nome`: nome da estação.
- `localizacao`: localização da estação.
- `ativo`: indica se o dispositivo está ativo.

### Leitura
- `id`: chave primária.
- `altura`: altura da água em metros.
- `tendencia`: subindo, estavel ou descendo.
- `data`: data e hora da leitura.
- `status`: classificação do risco.
- `dispositivo_id`: chave estrangeira para Dispositivo.

## Relacionamentos

Um dispositivo pode possuir várias leituras. Cada leitura pode estar vinculada a um dispositivo por meio da chave estrangeira `dispositivo_id`.

A entidade Usuario armazena as informações de autenticação e o perfil que determina as permissões de acesso.