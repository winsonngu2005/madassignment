import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export default function Chart({
  option,
  height = 300,
}: {
  option: echarts.EChartsOption;
  height?: number;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!divRef.current) return;
    chartRef.current = echarts.init(divRef.current);
    const onResize = () => chartRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={divRef} style={{ width: '100%', height }} />;
}
