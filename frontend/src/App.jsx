import React from 'react'
import { Link } from 'react-router'

const App = () => {
  return (
    <div>

    To go to the dashboard page click the link{" "}
      <Link className=' text-blue-400 hover:text-blue-700 cursor-pointer' to={'/dashboard'}>
        Dashboard
      </Link>
    </div>
  )
}

export default App
