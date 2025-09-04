import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trophy, School, User, BookOpen, Award, GraduationCap, ExternalLink, ArrowLeft } from "lucide-react";

// Helper for grade colors
const getGradeColor = (grade: string) => {
  switch (grade) {
    case "A": return "bg-success text-success-foreground";
    case "S": return "bg-primary text-primary-foreground";
    case "D": return "bg-warning text-warning-foreground";
    case "C": return "bg-accent text-accent-foreground";
    case "F": return "bg-destructive text-destructive-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

interface Subject {
  subject: {
    subjectName: string;
  };
  subjectWeightedPercent: number;
  markPercent: number;
  letterGrade: string;
  subjectId: string;
}

interface StudentResult {
  studentNames: string;
  studentIndexNumber: string;
  studentNationalId?: string;
  academicYear: string;
  attendedSchool?: string;
  weightedPercent: number;
  division: string;
  combination?: string;
  rawMark: Subject[];
  placedSchoolName?: string;
  placedCombinationName?: string;
}

const ResultsChecker = () => {
  const [activeTab, setActiveTab] = useState("ADVANCED");
  const { toast } = useToast();

  // Individual states
  const [indexNumber, setIndexNumber] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StudentResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Class states
  const [schoolCode, setSchoolCode] = useState("");
  const [levelCode, setLevelCode] = useState("");
  const [examYear, setExamYear] = useState("");
  const [classLoading, setClassLoading] = useState(false);
  const [classResults, setClassResults] = useState<StudentResult[]>([]);
  const [classSchoolName, setClassSchoolName] = useState("");
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  // Individual fetch
  const getResults = async () => {
    if (!indexNumber || (activeTab === "ADVANCED" && !nationalId)) {
      toast({
        title: "Missing Information",
        description: "Please enter all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      let apiUrl = "";
      if (activeTab === "ORDINARY") {
        apiUrl = `https://secondary.sdms.gov.rw/api//api/results-publication/findByIndex?indexNumber=${indexNumber}&_t=${Date.now()}&_cb=${Math.random()}`;
      } else {
        apiUrl = `https://secondary.sdms.gov.rw/api//api/results-publication/findByIndexAndNationalId?indexNumber=${indexNumber}&nationalId=${nationalId}&_t=${Date.now()}&_cb=${Math.random()}`;
      }

      const res = await fetch(apiUrl, { headers: { "Accept": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch results");
      const data = await res.json();

      if (!data || !data.studentNames) {
        toast({
          title: "No Results Found",
          description: "Please check your details and try again.",
          variant: "destructive",
        });
      } else {
        setResult(data);
        setIsModalOpen(true); // Open modal automatically when results are retrieved
        toast({
          title: "Results Retrieved!",
          description: "Your results have been successfully loaded.",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: `Error fetching results: ${err instanceof Error ? err.message : "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Class fetch
  const fetchClassResults = async () => {
    if (!schoolCode || !levelCode || !examYear) {
      toast({
        title: "Missing Information",
        description: "Please enter School Code, Level Code (OLC/PR), and Exam Year.",
        variant: "destructive",
      });
      return;
    }

    setClassLoading(true);
    setClassResults([]);
    setClassSchoolName("");

    try {
      const results: StudentResult[] = [];
      let seq = 1;
      let emptyCount = 0;
      const MAX_CONSECUTIVE_EMPTY = 20;
      const MAX_STUDENTS = 1000;

      while (emptyCount < MAX_CONSECUTIVE_EMPTY && seq <= MAX_STUDENTS) {
        const seqStr = String(seq).padStart(3, "0");
        const idx = `${schoolCode}${levelCode.toUpperCase()}${seqStr}${examYear}`;
        try {
          const res = await fetch(
            `https://secondary.sdms.gov.rw/api//api/results-publication/findByIndex?indexNumber=${idx}&_t=${Date.now()}&_cb=${Math.random()}`,
            { headers: { Accept: "application/json" } }
          );
          if (!res.ok) {
            emptyCount++;
            seq++;
            continue;
          }
          const data = await res.json();
          if (data && data.studentNames) {
            results.push(data);
            emptyCount = 0;
          } else {
            emptyCount++;
          }
        } catch {
          emptyCount++;
        }
        seq++;
      }

      results.sort((a, b) => (b?.weightedPercent ?? 0) - (a?.weightedPercent ?? 0));

      if (results.length > 0) {
        setClassSchoolName(results[0].attendedSchool ?? "");
        setClassResults(results);
        setIsClassModalOpen(true); // Open class modal automatically when results are retrieved
        toast({
          title: "Class Results Retrieved!",
          description: `Found results for ${results.length} students.`,
        });
      } else {
        toast({
          title: "No Results Found",
          description: "No results found for this class. Double-check school code, level and year.",
          variant: "destructive",
        });
        setClassResults(results);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: `Error fetching class results: ${err instanceof Error ? err.message : "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setClassLoading(false);
    }
  };

  // Build dynamic subject columns for class table
  const classSubjects = useMemo(() => {
    if (classResults.length === 0) return [];
    
    const subjectSet = new Set<string>();
    classResults.forEach((st) => {
      if (Array.isArray(st.rawMark)) {
        st.rawMark.forEach((m) => {
          if (m?.subject?.subjectName) subjectSet.add(m.subject.subjectName);
        });
      }
    });
    return Array.from(subjectSet);
  }, [classResults]);

  // CSV Export function
  const exportClassResultsCSV = () => {
    if (classResults.length === 0) {
      toast({
        title: "No Data",
        description: "No class results to export.",
        variant: "destructive",
      });
      return;
    }

    // Build CSV header
    const headers = [
      "Index Number",
      "Name", 
      "Weighted %",
      "Division",
      "Placed School",
      "Placed Combination",
      ...classSubjects
    ];

    // Build CSV rows
    const rows = classResults.map(student => {
      const row = [
        student.studentIndexNumber,
        student.studentNames,
        student.weightedPercent + "%",
        student.division,
        student.placedSchoolName || "-",
        student.placedCombinationName || "-"
      ];

      // Add subject marks
      classSubjects.forEach(subject => {
        const markObj = student?.rawMark?.find((m) => m?.subject?.subjectName === subject);
        if (markObj) {
          const mark = typeof markObj.markPercent === "number" ? `${markObj.markPercent.toFixed(1)}%` : "-";
          const grade = markObj.letterGrade ?? "-";
          row.push(`${mark} (${grade})`);
        } else {
          row.push("-");
        }
      });

      return row;
    });

    // Create CSV content
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `class_results_${schoolCode}_${levelCode}_${examYear}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Complete",
      description: "Class results have been exported to CSV.",
    });
  };

  // Function to open results in popup
  const openResultsPopup = () => {
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-primary shadow-soft">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap className="h-8 w-8 text-white" />
            <h1 className="text-3xl font-bold text-white">Rwanda Education Results Portal</h1>
          </div>
          <p className="text-white/90 text-lg">Check your academic results online - Available 24/7</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Main Form Card */}
        <Card className="shadow-card bg-gradient-card border-0 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <BookOpen className="h-6 w-6" />
              Check Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto gap-1 sm:gap-0">
                <TabsTrigger value="ADVANCED" className="text-xs sm:text-sm p-2 sm:p-3">Advanced / TSS / Professional</TabsTrigger>
                <TabsTrigger value="ORDINARY" className="text-xs sm:text-sm p-2 sm:p-3">Ordinary / Primary</TabsTrigger>
                <TabsTrigger value="CLASS" className="text-xs sm:text-sm p-2 sm:p-3">Whole Class</TabsTrigger>
              </TabsList>

              {/* Individual Forms */}
              <TabsContent value="ADVANCED" className="space-y-4">
                <div className="space-y-4">
                  <Input
                    placeholder="Enter Index Number"
                    value={indexNumber}
                    onChange={(e) => setIndexNumber(e.target.value)}
                    className="text-lg"
                  />
                  <Input
                    placeholder="Enter National Identity Number"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    className="text-lg"
                  />
                  <Button
                    onClick={getResults}
                    disabled={loading}
                    className="w-full bg-gradient-primary text-lg py-6 font-semibold"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Fetching Results...</>
                    ) : (
                      <><Trophy className="mr-2 h-5 w-5" />Get My Results</>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="ORDINARY" className="space-y-4">
                <div className="space-y-4">
                  <Input
                    placeholder="Enter Index Number"
                    value={indexNumber}
                    onChange={(e) => setIndexNumber(e.target.value)}
                    className="text-lg"
                  />
                  <Button
                    onClick={getResults}
                    disabled={loading}
                    className="w-full bg-gradient-primary text-lg py-6 font-semibold"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Fetching Results...</>
                    ) : (
                      <><Trophy className="mr-2 h-5 w-5" />Get My Results</>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="CLASS" className="space-y-4">
                <div className="space-y-4">
                  <Input
                    placeholder="School Code (first 6 digits)"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value)}
                    className="text-lg"
                  />
                  <Input
                    placeholder="Level Code (e.g., OLC for Ordinary, PR for Primary)"
                    value={levelCode}
                    onChange={(e) => setLevelCode(e.target.value)}
                    className="text-lg"
                  />
                  <Input
                    placeholder="Exam Year (e.g., 2025)"
                    value={examYear}
                    onChange={(e) => setExamYear(e.target.value)}
                    className="text-lg"
                  />
                  <Button
                    onClick={fetchClassResults}
                    disabled={classLoading}
                    className="w-full bg-gradient-primary text-lg py-6 font-semibold"
                  >
                    {classLoading ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Fetching Class Results...</>
                    ) : (
                      <><School className="mr-2 h-5 w-5" />Fetch Class Results</>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {/* Help Cards */}
            <div className="grid md:grid-cols-2 gap-4 mt-6">
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Need Help?</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <ul className="space-y-1">
                    <li>• Contact your school for your index number</li>
                    <li>• Results are available 24/7 online</li>
                    <li>• Call help desk: 9070 | Email: info@nesa.gov.rw</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quick Tips</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <ul className="space-y-1">
                    <li>• Double-check your index number</li>
                    <li>• Results are final and official</li>
                    <li>• Download your results confirmation after viewing</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Empty State for Class */}
        {activeTab === "CLASS" && classResults.length === 0 && !classLoading && (
          <Card className="bg-muted/20 border-dashed">
            <CardContent className="text-center py-12">
              <School className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No class results fetched yet. Enter the School Code, Level (OLC/PR), and Exam Year above, then click <strong>FETCH CLASS RESULTS</strong>.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Individual Results Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6" />
                Academic Results
              </DialogTitle>
              <Button
                onClick={() => setIsModalOpen(false)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          </DialogHeader>
          
          {result && (
            <div className="space-y-6 pt-4">
              {/* Header Section */}
              <div className="bg-gradient-primary text-white rounded-lg p-6 text-center">
                <h2 className="text-2xl font-bold mb-2">🎓 Academic Results</h2>
                <p className="text-white/90">Rwanda Education Results Portal</p>
              </div>

              {/* Student Info Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-gradient-card border-0">
                  <CardHeader>
                    <CardTitle className="text-lg">👤 Student Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{result.studentNames}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Index Number:</span>
                      <span className="font-medium">{result.studentIndexNumber}</span>
                    </div>
                    {result.studentNationalId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Student ID:</span>
                        <span className="font-medium">{result.studentNationalId}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Academic Year:</span>
                      <span className="font-medium">{result.academicYear}</span>
                    </div>
                    {result.attendedSchool && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">School:</span>
                        <span className="font-medium">{result.attendedSchool}</span>
                      </div>
                    )}
                    {result.placedSchoolName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Placed School:</span>
                        <span className="font-medium">{result.placedSchoolName}</span>
                      </div>
                    )}
                    {result.placedCombinationName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Placed Combination:</span>
                        <span className="font-medium">{result.placedCombinationName}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card border-0">
                  <CardHeader>
                    <CardTitle className="text-lg">🏆 Performance Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Subjects:</span>
                      <span className="font-medium">{result.rawMark?.length ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Weighted Percentage:</span>
                      <span className="font-bold text-success text-lg">{result.weightedPercent}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Overall Result:</span>
                      <span className={`font-bold text-lg ${result.division === 'PASS' ? 'text-success' : 'text-destructive'}`}>
                        {result.division}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Subjects Table */}
              <Card className="bg-gradient-card border-0">
                <CardHeader>
                  <CardTitle className="text-lg">📚 Subject Level Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow className="bg-primary">
                          <TableHead className="text-primary-foreground font-semibold">Subject</TableHead>
                          <TableHead className="text-primary-foreground font-semibold">Subject Weight</TableHead>
                          <TableHead className="text-primary-foreground font-semibold">Raw Marks (%)</TableHead>
                          <TableHead className="text-primary-foreground font-semibold">Letter Grade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.rawMark?.map((subject, index) => (
                          <TableRow key={index} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                            <TableCell className="font-medium">{subject.subject.subjectName}</TableCell>
                            <TableCell>{subject.subjectWeightedPercent}</TableCell>
                            <TableCell className="font-semibold">{Number(subject.markPercent).toFixed(1)}%</TableCell>
                            <TableCell>
                              <Badge className={getGradeColor(subject.letterGrade)}>
                                {subject.letterGrade}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Footer */}
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  ⚠️ <strong>This is not an official results checking website.</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Official results are available at: <a href="https://nesa.gov.rw" className="text-primary hover:underline">nesa.gov.rw</a>
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Class Results Modal */}
      <Dialog open={isClassModalOpen} onOpenChange={setIsClassModalOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <School className="h-6 w-6" />
                Class Results - {classSchoolName}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  onClick={exportClassResultsCSV}
                  variant="outline"
                  size="sm"
                >
                  Export CSV
                </Button>
                <Button
                  onClick={() => setIsClassModalOpen(false)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground">
              Showing results for <span className="font-bold">{classResults.length}</span> students
            </p>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            <div className="w-full h-[70vh] overflow-auto border rounded-md">
              <Table className="w-full">
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="text-xs sticky top-0 bg-background border-r min-w-[100px] font-semibold">Index No.</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background border-r min-w-[150px] font-semibold">Name</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background border-r min-w-[80px] font-semibold">Weight %</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background border-r min-w-[70px] font-semibold">Division</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background border-r min-w-[120px] font-semibold">Placed School</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background border-r min-w-[120px] font-semibold">Placed Combination</TableHead>
                    {classSubjects.map((subject) => (
                      <TableHead 
                        key={subject} 
                        className="text-xs sticky top-0 bg-background border-r min-w-[90px] font-semibold text-center"
                        title={subject}
                      >
                        {subject.length > 10 ? `${subject.substring(0, 10)}...` : subject}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classResults.map((student, index) => (
                    <TableRow key={index} className="hover:bg-muted/50">
                      <TableCell className="font-medium text-xs border-r">{student.studentIndexNumber}</TableCell>
                      <TableCell className="text-xs border-r" title={student.studentNames}>
                        {student.studentNames.length > 20 ? `${student.studentNames.substring(0, 20)}...` : student.studentNames}
                      </TableCell>
                      <TableCell className="font-bold text-xs border-r text-center">{student.weightedPercent}%</TableCell>
                      <TableCell className="border-r text-center">
                        <Badge className={`text-xs ${student.division === "PASS" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}>
                          {student.division}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs border-r" title={student.placedSchoolName || "-"}>
                        {student.placedSchoolName ? 
                          (student.placedSchoolName.length > 15 ? `${student.placedSchoolName.substring(0, 15)}...` : student.placedSchoolName) 
                          : "-"}
                      </TableCell>
                      <TableCell className="text-xs border-r" title={student.placedCombinationName || "-"}>
                        {student.placedCombinationName ? 
                          (student.placedCombinationName.length > 15 ? `${student.placedCombinationName.substring(0, 15)}...` : student.placedCombinationName) 
                          : "-"}
                      </TableCell>
                      {classSubjects.map((subject) => {
                        const markObj = student?.rawMark?.find((m) => m?.subject?.subjectName === subject);
                        const mark = typeof markObj?.markPercent === "number" ? `${markObj.markPercent.toFixed(1)}%` : "-";
                        const grade = markObj?.letterGrade ?? "-";
                        return (
                          <TableCell key={subject} className="border-r text-center">
                            {markObj ? (
                              <div className="text-center">
                                <div className="font-medium text-xs">{mark}</div>
                                <Badge className={`${getGradeColor(grade)} text-xs px-1 py-0`}>
                                  {grade}
                                </Badge>
                              </div>
                            ) : <span className="text-xs">-</span>}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <p className="text-sm text-center font-medium text-warning-foreground">
                ⚠️ Note: This method only works for <strong>Primary and Ordinary level</strong> students.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResultsChecker;