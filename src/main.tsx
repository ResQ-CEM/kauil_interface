import React from "react";
import "./App.css";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Home from "./routes/homeScreen";
import Arm from "./routes/arm";
import Data from "./routes/data";
import Cameras from "./routes/cameras";

const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />, // Layout común
    children: [
      { index: true, element: <Home /> },
      { path: "arm", element: <Arm /> },
      { path: "Data", element: <Data /> },
      { path: "cameras", element: <Cameras /> },
     
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
