import React from 'react'
import { Link } from 'react-router'

const App = () => {
  return (
    <div>
      <Link to={'/dashboard'}>
        Dashboard
      </Link>
    </div>
  )
}

export default App
