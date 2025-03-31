# NCDU Web

A modern web-based disk usage analyzer inspired by the popular terminal-based tool NCDU (NCurses Disk Usage).

## Features

- **Interactive Treemap Visualization**: Explore disk usage with an intuitive, interactive treemap
- **Real-time Analysis**: Monitor disk usage changes in real-time via WebSocket
- **Customizable Settings**: Configure the application to suit your preferences
- **Dashboard Overview**: Get a quick summary of your disk usage across mount points
- **Path Navigation**: Drill down into specific directories to analyze space usage
- **Delete Functionality**: Remove files and directories directly from the interface

## Tech Stack

### Frontend
- React with TypeScript
- Mantine UI components
- D3.js for data visualization
- React Router for navigation

### Backend
- Node.js with Express
- WebSocket for real-time updates
- TypeScript for type safety

## Getting Started

### Prerequisites
- Node.js (v14 or later)
- npm (v6 or later)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ncdu-web.git
cd ncdu-web
```

2. Install dependencies for both frontend and backend:
```bash
npm install
cd server
npm install
cd ..
```

3. Start the development server:
```bash
npm run dev
```

This will start:
- Frontend at http://localhost:3000
- Backend API at http://localhost:3001

## Usage

### Dashboard
The dashboard provides an overview of all mount points on your system with usage statistics.

### Analysis
The analysis page shows a detailed treemap visualization of your disk usage. You can:
- Click on directories to navigate deeper
- Use the breadcrumb navigation to go back up
- Delete files or directories by selecting them and using the delete button
- Refresh the analysis to get updated data

### Settings
Configure the application behavior:
- Toggle dark mode
- Set auto-refresh interval
- Configure paths to exclude from analysis
- Show/hide hidden files

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by the original [NCDU](https://dev.yorhel.nl/ncdu) by Yorhel
- Built with [React](https://reactjs.org/) and [Mantine UI](https://mantine.dev/)
- Visualization powered by [D3.js](https://d3js.org/) 