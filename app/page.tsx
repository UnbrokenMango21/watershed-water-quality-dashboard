import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, BarChart3, Table2, Lock } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Watershed Dashboard</h1>
          </div>
          <nav className="flex gap-4">
            <a
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Dashboard
            </a>
            <a
              href="/data-explorer"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Data Explorer
            </a>
            <a
              href="/signin"
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Sign In
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Watershed Water Quality Dashboard
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Public-facing watershed water quality monitoring with dynamic parameter charts, 
            interactive site mapping, and comprehensive data exploration.
          </p>
          <div className="flex gap-4 justify-center">
            <a href="/dashboard">
              <Button size="lg" className="gap-2">
                <MapPin className="w-5 h-5" />
                View Dashboard
              </Button>
            </a>
            <a href="/data-explorer">
              <Button size="lg" variant="outline" className="gap-2">
                <Table2 className="w-5 h-5" />
                Explore Data
              </Button>
            </a>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <MapPin className="w-8 h-8 text-blue-600 mb-2" />
              <CardTitle>Interactive Map</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Visualize monitoring sites on an interactive map. Click sites to view 
                detailed information and latest measurements.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BarChart3 className="w-8 h-8 text-blue-600 mb-2" />
              <CardTitle>Time Series Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Analyze water quality trends over time with dynamic parameter selection 
                and sharp-line time-series charts.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Table2 className="w-8 h-8 text-blue-600 mb-2" />
              <CardTitle>Data Explorer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Browse and search all water quality measurements with advanced filtering 
                and export capabilities.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Data Sources */}
        <Card className="mb-16">
          <CardHeader>
            <CardTitle>Data Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">ArcGIS FeatureServer</h3>
                <p className="text-gray-600">
                  Automatically ingests data from ArcGIS FeatureServer endpoints with support 
                  for geospatial features and attribute filtering.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">CSV Import</h3>
                <p className="text-gray-600">
                  Upload and process CSV files containing water quality measurements with 
                  automatic field mapping and validation.
                </p>
              </div>
              <div className="text-sm text-gray-500 mt-4">
                <strong>Note:</strong> Landowner information is automatically excluded from all 
                public displays to protect privacy.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Access Modes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Access Modes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Public Mode (Current)</h3>
                <p className="text-gray-600">
                  Access real-time water quality data, interactive maps, and time-series 
                  analysis without authentication.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Researcher Mode (Coming Soon)</h3>
                <p className="text-gray-600">
                  Authentication-protected mode for researchers with additional features 
                  including data export, advanced analytics, and administrative tools.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="container mx-auto px-6 text-center text-gray-600">
          <p>Watershed Water Quality Dashboard - Public Mode</p>
          <p className="text-sm mt-2">
            Data updated in real-time from ArcGIS FeatureServer and CSV sources
          </p>
        </div>
      </footer>
    </div>
  );
}
