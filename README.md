# Red Pandas - LLM powered Data Analytics

A lightweight data analytics application that leverages LLMs to analyze and interpret data through natural language queries.

## 🚀 Features

- Upload CSV data files
- Ask natural language questions about your data
- Get AI-powered insights and analysis
- Maintain conversation history
- Simple, clean interface for data exploration

## 🛠 Tech Stack

- **Frontend**: React (Vite) + TypeScript + Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI**: OpenAI API

## 📋 Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- MongoDB (for local development - skip if deploying directly to Railway)
- OpenAI API key

## 🏃‍♂️ Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/pawel-kncck/red-pandas
cd red-pandas
```

### 2. Set up MongoDB

**Option A: MongoDB Atlas (Recommended - Free tier available)**

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster and get your connection string

**Option B: Local MongoDB with Docker**

```bash
docker run -d -p 27017:27017 --name red-pandas-mongo mongo
```

### 3. Set up the Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the backend directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
MONGODB_URL=mongodb://localhost:27017/
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/
DATABASE_NAME=red_pandas_db
```

Run the backend server:

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

### 4. Set up the Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

## 📁 Project Structure

```
red-pandas/
├── backend/
│   ├── main.py           # FastAPI application
│   ├── database.py       # MongoDB connection
│   ├── models.py         # Pydantic models
│   ├── services/         # Business logic
│   │   └── openai_service.py
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

| Method | Endpoint                            | Description                                  |
| ------ | ----------------------------------- | -------------------------------------------- |
| GET    | `/api/health`                       | Health check                                 |
| POST   | `/api/session/create`               | Create new analysis session with data upload |
| GET    | `/api/session/{session_id}`         | Get session details and history              |
| POST   | `/api/session/{session_id}/analyze` | Analyze data with LLM query                  |
| GET    | `/api/sessions`                     | List all sessions                            |

## 💬 Example Queries

Once you upload your data (CSV), you can ask questions like:

- "What are the top 5 products by revenue?"
- "Show me the trend over the last 6 months"
- "Which category has the highest growth rate?"
- "Summarize the key insights from this data"

## 🚢 Deployment

### Deploy to Railway (Recommended - All-in-one)

1. Create account at [Railway](https://railway.app)
2. Install Railway CLI: `npm i -g @railway/cli`
3. From project root: `railway login && railway up`
4. Add MongoDB from Railway's template marketplace
5. Set environment variables in Railway dashboard
6. Update frontend's `VITE_API_URL` to your Railway backend URL

## 🆘 Support

For issues and questions, please open a GitHub issue.

---

**Note**: This is an MVP version. Features like authentication, advanced visualizations, and data persistence will be added in future iterations.
