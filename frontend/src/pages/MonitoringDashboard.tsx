import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Alert, AlertDescription } from '../components/ui/Alert';
// import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Activity, Server, AlertTriangle, CheckCircle, XCircle, Clock, Cpu, HardDrive } from 'lucide-react';

interface SystemMetrics {
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; usage: number; available: number };
  disk: { total: number; used: number; usage: number; available: number };
  network: { bytesIn: number; bytesOut: number };
  load: { load1: number; load5: number; load15: number };
}

interface ServiceHealth {
  backend: {
    status: string;
    responseTime: number;
    availability: number;
    consecutiveFailures: number;
  };
  frontend: {
    status: string;
    responseTime: number;
    availability: number;
    consecutiveFailures: number;
  };
  lastCheck: string;
}

interface PM2Process {
  name: string;
  status: string;
  uptime: number;
  memory: number;
  cpu: number;
  restarts: number;
  pid: number;
  instances: number;
}

interface AlertSummary {
  critical: number;
  warning: number;
  info: number;
  total: number;
  period: string;
}

interface DashboardData {
  system: SystemMetrics;
  health: ServiceHealth;
  services: PM2Process[];
  alerts: AlertSummary;
  uptime: number;
  lastUpdate: string;
}

const MonitoringDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // 秒

  // 获取仪表板数据
  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/monitoring/dashboard');
      const result = await response.json();
      
      if (result.success) {
        setDashboardData(result.data);
        setError(null);
      } else {
        setError(result.error || '获取数据失败');
      }
    } catch (err) {
      setError('网络连接失败');
    } finally {
      setLoading(false);
    }
  };

  // 自动刷新
  useEffect(() => {
    fetchDashboardData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // 格式化字节数
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化运行时间
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}天 ${hours}小时`;
    if (hours > 0) return `${hours}小时 ${minutes}分钟`;
    return `${minutes}分钟`;
  };

  // 获取状态颜色
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'online':
        return 'text-green-600';
      case 'unhealthy':
      case 'stopped':
      case 'errored':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'online':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'unhealthy':
      case 'stopped':
      case 'errored':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>加载监控数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="mb-6">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            {error}
            <Button 
              onClick={fetchDashboardData} 
              className="ml-4"
              size="sm"
            >
              重试
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!dashboardData) {
    return <div>无数据</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题和控制 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">WordPecker 监控仪表板</h1>
          <p className="text-gray-600 mt-1">
            最后更新: {new Date(dashboardData.lastUpdate).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm">自动刷新:</label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
          </div>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-1 border rounded"
            disabled={!autoRefresh}
          >
            <option value={10}>10秒</option>
            <option value={30}>30秒</option>
            <option value={60}>1分钟</option>
            <option value={300}>5分钟</option>
          </select>
          <Button onClick={fetchDashboardData} size="sm">
            手动刷新
          </Button>
        </div>
      </div>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 系统运行时间 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">系统运行时间</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUptime(dashboardData.uptime)}</div>
            <p className="text-xs text-muted-foreground">
              自上次重启以来
            </p>
          </CardContent>
        </Card>

        {/* CPU 使用率 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU 使用率</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.system.cpu.usage.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.system.cpu.cores} 核心
            </p>
          </CardContent>
        </Card>

        {/* 内存使用率 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">内存使用率</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.system.memory.usage}%</div>
            <p className="text-xs text-muted-foreground">
              {formatBytes(dashboardData.system.memory.used)} / {formatBytes(dashboardData.system.memory.total)}
            </p>
          </CardContent>
        </Card>

        {/* 磁盘使用率 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">磁盘使用率</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.system.disk.usage}%</div>
            <p className="text-xs text-muted-foreground">
              {formatBytes(dashboardData.system.disk.used)} / {formatBytes(dashboardData.system.disk.total)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容区域 */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="services">服务状态</TabsTrigger>
          <TabsTrigger value="alerts">告警管理</TabsTrigger>
          <TabsTrigger value="performance">性能分析</TabsTrigger>
        </TabsList>

        {/* 概览标签页 */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 服务健康状态 */}
            <Card>
              <CardHeader>
                <CardTitle>服务健康状态</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(dashboardData.health.backend.status)}
                    <div>
                      <p className="font-medium">后端服务</p>
                      <p className="text-sm text-gray-600">
                        响应时间: {dashboardData.health.backend.responseTime}ms
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={getStatusColor(dashboardData.health.backend.status)}>
                      {dashboardData.health.backend.status}
                    </Badge>
                    <p className="text-sm text-gray-600 mt-1">
                      可用性: {dashboardData.health.backend.availability}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(dashboardData.health.frontend.status)}
                    <div>
                      <p className="font-medium">前端服务</p>
                      <p className="text-sm text-gray-600">
                        响应时间: {dashboardData.health.frontend.responseTime}ms
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={getStatusColor(dashboardData.health.frontend.status)}>
                      {dashboardData.health.frontend.status}
                    </Badge>
                    <p className="text-sm text-gray-600 mt-1">
                      可用性: {dashboardData.health.frontend.availability}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 告警摘要 */}
            <Card>
              <CardHeader>
                <CardTitle>告警摘要 ({dashboardData.alerts.period})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-red-600">
                      {dashboardData.alerts.critical}
                    </div>
                    <p className="text-sm text-gray-600">严重告警</p>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-yellow-600">
                      {dashboardData.alerts.warning}
                    </div>
                    <p className="text-sm text-gray-600">警告告警</p>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-blue-600">
                      {dashboardData.alerts.info}
                    </div>
                    <p className="text-sm text-gray-600">信息告警</p>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-gray-600">
                      {dashboardData.alerts.total}
                    </div>
                    <p className="text-sm text-gray-600">总计</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 系统负载 */}
          <Card>
            <CardHeader>
              <CardTitle>系统负载</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {dashboardData.system.load.load1.toFixed(2)}
                  </div>
                  <p className="text-sm text-gray-600">1分钟</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {dashboardData.system.load.load5.toFixed(2)}
                  </div>
                  <p className="text-sm text-gray-600">5分钟</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {dashboardData.system.load.load15.toFixed(2)}
                  </div>
                  <p className="text-sm text-gray-600">15分钟</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 服务状态标签页 */}
        <TabsContent value="services" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>PM2 进程状态</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">服务名称</th>
                      <th className="text-left p-3">状态</th>
                      <th className="text-left p-3">PID</th>
                      <th className="text-left p-3">运行时间</th>
                      <th className="text-left p-3">内存使用</th>
                      <th className="text-left p-3">CPU使用</th>
                      <th className="text-left p-3">重启次数</th>
                      <th className="text-left p-3">实例数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.services.map((service, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-3 font-medium">{service.name}</td>
                        <td className="p-3">
                          <Badge className={getStatusColor(service.status)}>
                            {service.status}
                          </Badge>
                        </td>
                        <td className="p-3">{service.pid}</td>
                        <td className="p-3">{formatUptime((Date.now() - service.uptime) / 1000)}</td>
                        <td className="p-3">{formatBytes(service.memory)}</td>
                        <td className="p-3">{service.cpu}%</td>
                        <td className="p-3">{service.restarts}</td>
                        <td className="p-3">{service.instances}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 告警管理标签页 */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>告警配置</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">告警配置功能开发中...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 性能分析标签页 */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>性能趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">性能趋势图表开发中...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonitoringDashboard;