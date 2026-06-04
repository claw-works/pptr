import { Routes, Route } from 'react-router-dom'
import ProjectList from './pages/ProjectList'
import CreateSession from './pages/CreateSession'
import Editor from './pages/Editor'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectList />} />
      <Route path="/project/:id" element={<CreateSession />} />
      <Route path="/editor/:id" element={<Editor />} />
    </Routes>
  )
}
