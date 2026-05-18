import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

const MainLayout: React.FC = () => {
  return (
    <div className="flex h-screen w-screen bg-gray-950 text-white overflow-hidden">
      {/* Sidebar fijo */}
      <Sidebar />

      {/* Contenedor principal */}
      <div className="flex flex-col flex-1 ml-[17rem] mr-4 my-4 min-h-0">
        <Header />
        <main
          className="
            flex-1 
            bg-gray-900 rounded-2xl shadow-lg border border-gray-800 p-6
            overflow-auto md:overflow-hidden 
            min-h-[calc(100vh-7rem)] md:min-h-0
            transition-all duration-300
          "
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
