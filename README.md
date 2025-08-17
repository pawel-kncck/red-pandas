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

### For Docker Development (Recommended)

- Docker Desktop
- Docker Compose
- OpenAI API key

### For Local Development

- Node.js 18+ and npm
- Python 3.8+
- MongoDB
- OpenAI API key

## 🐳 Quick Start with Docker (Recommended)

### 1. Clone the repository

```bash
git clone https://github.com/pawel-kncck/red-pandas
cd red-pandas
```

### 2. Set up environment variables

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and add your OPENAI_API_KEY
```

### 3. Start the development environment

```bash
# Make the script executable (first time only)
chmod +x dev.sh

# Start all services
./dev.sh start

# Or use make
make start
```

### 4. Access the application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **MongoDB**: localhost:27017

### Docker Development Commands

```bash
# View logs
./dev.sh logs [service]  # service: backend, frontend, or mongodb

# Open shell in container
./dev.sh shell [service]

# Restart services
./dev.sh restart

# Stop all services
./dev.sh stop

# Clean up (removes containers and data)
./dev.sh clean

# Rebuild containers
./dev.sh rebuild

# Check status
./dev.sh status
```

## 🏃‍♂️ Local Development Setup (Alternative)

### 1. Clone the repository

```bash
git clone https://github.com/pawel-kncck/red-pandas
cd red-pandas
```

### 2. Set up MongoDB

**Option A: MongoDB with Docker**

```bash
docker run -d -p 27017:27017 --name red-pandas-mongo mongo
```

**Option B: MongoDB Atlas (Cloud)**

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster and get your connection string

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

### 4. Set up the Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

## 📁 Project Structure

```
red-pandas/
├── docker-compose.yml     # Docker orchestration
├── dev.sh                 # Development scripts
├── Makefile              # Quick commands
├── backend/
│   ├── Dockerfile.dev    # Backend Docker config
│   ├── main.py           # FastAPI application
│   ├── database.py       # MongoDB connection
│   ├── models.py         # Pydantic models
│   ├── code_validator.py # Code security validation
│   ├── executor.py       # Safe code execution
│   ├── conversation_manager.py # Context management
│   ├── openai_client.py # LLM integration
│   ├── config.py         # Settings management
│   ├── .env              # Environment variables
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── Dockerfile.dev    # Frontend Docker config
│   ├── src/
│   │   ├── App.tsx       # Main React component
│   │   ├── components/   # React components
│   │   ├── api/          # API client
│   │   └── types/        # TypeScript types
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
| DELETE | `/api/session/{session_id}`         | Delete a session                             |

## 💬 Example Queries

Once you upload your data (CSV), you can ask questions like:

- "What are the top 5 products by revenue?"
- "Show me the trend over the last 6 months"
- "Which category has the highest growth rate?"
- "Summarize the key insights from this data"
- "What's the correlation between price and sales volume?"
- "Find outliers in the dataset"
- "Create a summary statistics table"

## 🔧 Development Features

### Hot Reloading

Both frontend and backend support hot reloading:

- **Backend**: Uses `uvicorn --reload` with file watching
- **Frontend**: Uses Vite's HMR (Hot Module Replacement)

### Security Features

- AST-based code validation before execution
- Sandboxed Python execution environment
- Restricted imports and built-in functions
- Resource limits (timeout, memory, output size)

### Conversation Context

- Maintains conversation history for better follow-up questions
- Context-aware code generation
- Session persistence in MongoDB

## 🚢 Production Deployment

### Deploy to Railway

1. Create account at [Railway](https://railway.app)
2. Install Railway CLI: `npm i -g @railway/cli`
3. From project root: `railway login && railway up`
4. Add MongoDB from Railway's template marketplace
5. Set environment variables in Railway dashboard
6. Update frontend's `VITE_API_URL` to your Railway backend URL

### Deploy with Docker

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Run in production mode
docker-compose -f docker-compose.prod.yml up -d
```

## 🧪 Testing

```bash
# Run backend tests (in Docker)
./dev.sh test

# Run backend tests (locally)
cd backend
pytest

# Run frontend tests
cd frontend
npm test
```

## 📝 Environment Variables

### Backend (.env)

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Database
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=red_pandas_db

# Optional - LLM Settings
OPENAI_MODEL=gpt-4o-mini
OPENAI_CODE_GENERATION_TEMPERATURE=0.1
OPENAI_INTERPRETATION_TEMPERATURE=0.3

# Optional - Execution Limits
MAX_EXECUTION_TIMEOUT=5
MAX_DATAFRAME_SIZE=100000000
MAX_OUTPUT_SIZE=10000
MAX_UPLOAD_SIZE=104857600

# Optional - Data Sampling
DEFAULT_SAMPLE_ROWS=5
MAX_SAMPLE_ROWS=10

# Optional - Conversation History
MAX_CONVERSATION_HISTORY=10
CONTEXT_LOOKBACK=3
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000  # Change for production
```

## 🔒 Security Considerations

- Code execution is sandboxed with restricted imports
- AST validation prevents dangerous operations
- Resource limits prevent DoS attacks
- Non-root users in Docker containers
- Environment variables for sensitive data

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions, please open a GitHub issue.

## 🗺️ Roadmap

- [ ] Authentication and user management
- [ ] Advanced data visualizations
- [ ] Support for more file formats (Excel, JSON)
- [ ] Export analysis results
- [ ] Collaborative sessions
- [ ] Custom LLM model support
- [ ] Scheduled data analysis
- [ ] API rate limiting

---

**Note**: This is an MVP version. Features are being actively developed. Check the roadmap for upcoming features.
