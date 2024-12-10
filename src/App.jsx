import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Home from './pages/Home';
import Search from './pages/Search';
import CourseRecords from './pages/CourseRecords';
import Header from './components/Header';
import Searchbar from './components/Searchbar';
import 'react-loading-skeleton/dist/skeleton.css'

function App() {
  return (
    <Router basename='/course-reserves'>
      <Header />
      <Searchbar />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/records" element={<CourseRecords />} />
          <Route path="*" element={<h1>Not Found</h1>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
