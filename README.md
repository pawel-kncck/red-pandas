# Data Analytics LLM MVP

A lightweight data analytics application that leverages LLMs to analyze and interpret data through natural language queries.

## 🚀 Features

- Upload CSV/JSON data files
- Ask natural language questions about your data
- Get AI-powered insights and analysis
- Simple, clean interface for data exploration

## 🛠 Tech Stack

- **Frontend**: React (Vite) + TypeScript + Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL
- **AI**: OpenAI API

## 📋 Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- PostgreSQL (or Docker)
- OpenAI API key

## 🏃‍♂️ Quick Start

### 1. Clone the repository

```bash
git clone <repository-url>
cd analytics-app
```

### 2. Set up the Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the backend directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=postgresql://user:password@localhost/analytics_db
```

Run the backend server:

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

### 3. Set up the Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

### 4. Set up PostgreSQL

Using Docker:

```bash
docker run --name analytics-db -e POSTGRES_PASSWORD=yourpassword -p 5432:5432 -d postgres
```

Or use a cloud provider like Supabase or Neon for quick setup.

## 📁 Project Structure

```
analytics-app/
├── backend/
│   ├── main.py           # FastAPI application
│   ├── models.py         # Database models
│   ├── .env             # Environment variables
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.tsx      # Main React component
│   │   ├── components/  # React components
│   │   └── api/         # API client
│   └── package.json
└── README.md
```

## 🔌 API Endpoints

| Method | Endpoint       | Description           |
| ------ | -------------- | --------------------- |
| GET    | `/api/health`  | Health check          |
| POST   | `/api/analyze` | Analyze data with LLM |
| POST   | `/api/upload`  | Upload data file      |

### Example Request

```bash
curl -X POST "http://localhost:8000/api/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What are the main trends in this data?",
    "data_context": "CSV data here..."
  }'
```

## 🚢 Deployment

### Quick Deploy Options

- **Backend**: Railway, Render, or Fly.io
- **Frontend**: Vercel or Netlify
- **Database**: Supabase, Neon, or Railway PostgreSQL

## 🔧 Environment Variables

### Backend (.env)

```
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
```

### Frontend (.env.local)

```
VITE_API_URL=http://localhost:8000
```

## 📝 Development

### Running Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

### Adding New Features

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test
3. Submit pull request

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License

## 🆘 Support

For issues and questions, please open a GitHub issue.

---

**Note**: This is an MVP version. Features like authentication, advanced visualizations, and data persistence will be added in future iterations.
