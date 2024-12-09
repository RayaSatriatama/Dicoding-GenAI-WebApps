import React from 'react'
import { Layout } from '../components/layout'

export default function Home() {
  return (
    <Layout>
      <h1 className="text-4xl font-bold mb-4">Welcome to the Dashboard</h1>
      <p className="text-lg text-muted-foreground mb-8">
        This is a sample page using the Layout component with the configurable Sidebar.
      </p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="p-6 bg-card rounded-lg shadow">
            <h2 className="text-2xl font-semibold mb-2">Card {item}</h2>
            <p className="text-muted-foreground">This is a sample card in the dashboard layout.</p>
          </div>
        ))}
      </div>
    </Layout>
  )
}

