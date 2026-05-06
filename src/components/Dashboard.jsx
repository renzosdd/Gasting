import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Dashboard({ user }) {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchGastos = async () => {
      const q = query(collection(db, "gastos"), where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      
      let totalSuma = 0;
      const gastosPorCategoria = {};

      querySnapshot.forEach((doc) => {
        const gasto = doc.data();
        totalSuma += gasto.monto;
        
        if (gastosPorCategoria[gasto.categoria]) {
          gastosPorCategoria[gasto.categoria] += gasto.monto;
        } else {
          gastosPorCategoria[gasto.categoria] = gasto.monto;
        }
      });

      const chartData = Object.keys(gastosPorCategoria).map(key => ({
        name: key,
        value: gastosPorCategoria[key]
      }));

      setData(chartData);
      setTotal(totalSuma);
    };

    fetchGastos();
  }, [user.uid]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm h-full flex flex-col">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Resumen</h2>
      
      <div className="bg-blue-50 p-4 rounded-xl mb-6">
        <p className="text-sm text-gray-600">Total Gastado</p>
        <p className="text-3xl font-bold text-blue-700">${total.toFixed(2)}</p>
      </div>

      <div className="flex-1 min-h-[300px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `$${value}`} />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-400 mt-10">No hay gastos registrados aún.</p>
        )}
      </div>
    </div>
  );
}