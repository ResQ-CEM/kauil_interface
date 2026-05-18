
export default function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-gray-900 text-white shadow-lg rounded-2xl mx-0 mt-0 mb-3 border border-gray-800">
      {/* Título */}
      <h1 className="text-xl font-bold tracking-wide">Kauil Control Interface</h1>

      {/* Logos + Estado */}
      <div className="flex items-center gap-10">
        {/* Logos */}
        

        {/* Estado */}
        <span className="text-green-400 font-medium">Connected</span>

        {/* Botón */}
        <button className="bg-gray-700 px-4 py-1 rounded-lg hover:bg-gray-600 transition">
          Settings
        </button>
      </div>
    </header>
  );
}
