import {Alert, AlertDescription} from "@/components/ui/alert";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {
	ArrowUpCircle,
	Check,
	Download,
	Loader2,
	Plus,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import React, {useCallback, useEffect, useState} from "react";
import {useFieldArray, useForm, type UseFormReturn} from "react-hook-form";
import {pb} from "./pocketbase";

interface Question {
	uid: string;
	answer: string;
}

interface AnswerKey {
	uid: string;
	correctAnswer: string;
}

interface QuestionsFormData {
	questions: Question[];
}

interface AnswerKeyFormData {
	answerKey: AnswerKey[];
}

interface ExportData {
	questions: Question[];
	answerKey: AnswerKey[];
	timestamp: string;
}

interface AppData {
	questions: Question[];
	answerKey: AnswerKey[];
}

type AnswerStatus = boolean | null;

interface SummaryStats {
	total: number;
	correct: number;
	incorrect: number;
	unanswered: number;
}

const AnswerSheetApp: React.FC = () => {
	const [activeTab, setActiveTab] = useState<"questions" | "key">("questions");
	const [data, setData] = useState<AppData>({questions: [], answerKey: []});
	const [loadingUpdateRemote, setLoadingUpdateRemote] = useState(false);

	const [isImporting, setIsImporting] = useState(false);

	const questionForm: UseFormReturn<QuestionsFormData> =
		useForm<QuestionsFormData>({
			defaultValues: {questions: []},
		});

	const keyForm: UseFormReturn<AnswerKeyFormData> = useForm<AnswerKeyFormData>({
		defaultValues: {answerKey: []},
	});

	const {
		fields: questionFields,
		append: appendQuestion,
		remove: removeQuestion,
		replace: replaceQuestions,
	} = useFieldArray({
		control: questionForm.control,
		name: "questions",
	});

	const {
		fields: keyFields,
		append: appendKey,
		remove: removeKey,
		replace: replaceKeys,
	} = useFieldArray({
		control: keyForm.control,
		name: "answerKey",
	});

	// Persist from remote
	useEffect(() => {
		(async () => {
			try {
				const data = await pb.collection("b").getOne("8x3q1fyyot9naxk");
				if (!data?.data || !data.data.questions?.length) {
					// addQuestions(5);
				} else {
					replaceQuestions(data.data.questions);
					replaceKeys(data.data.answerKey);
				}
				scrollTo(0, 0);
			} catch (error) {}
		})();
	}, []);

	// Watch form values to update data state
	const questionValues = questionForm.watch("questions");
	const keyValues = keyForm.watch("answerKey");

	// hack rerender
	const questionRerenderKeys = questionValues
		?.map((q) => q.uid + q.answer)
		.join();
	const keysRerenderKeys = keyValues
		?.map((k) => k.uid + k.correctAnswer)
		.join();

	useEffect(() => {
		const _data = {
			questions: questionValues || [],
			answerKey: keyValues || [],
		};
		updateRemote(_data);
		setData(_data);
	}, [questionRerenderKeys, keysRerenderKeys]);

	const updateRemote = async (data: AppData) => {
		if (loadingUpdateRemote) return;
		setLoadingUpdateRemote(true);
		try {
			await pb.collection("b").update("8x3q1fyyot9naxk", {data});
		} catch (error) {}
		setLoadingUpdateRemote(false);
	};

	const generateQuestions = useCallback((count: number): Question[] => {
		const timestamp = Date.now();
		return Array.from({length: count}, (_, i) => ({
			uid: `q_${timestamp}_${i}`,
			answer: "",
		}));
	}, []);

	const generateAnswerKeys = useCallback((count: number): AnswerKey[] => {
		const timestamp = Date.now();
		return Array.from({length: count}, (_, i) => ({
			uid: `q_${timestamp}_${i}`,
			correctAnswer: "",
		}));
	}, []);

	const addQuestions = useCallback(
		(count: number): void => {
			const newQuestions = generateQuestions(count);
			const newKeys = generateAnswerKeys(count);

			appendQuestion(newQuestions);
			appendKey(newKeys);
		},
		[appendQuestion, appendKey, generateQuestions, generateAnswerKeys]
	);

	const getAnswerStatus = useCallback(
		(questionId: string, answer: string): AnswerStatus => {
			const keyItem = data.answerKey.find((key) => key.uid === questionId);
			if (!keyItem?.correctAnswer || !answer) return null;

			return (
				answer.toLowerCase().trim() ===
				keyItem.correctAnswer.toLowerCase().trim()
			);
		},
		[data.answerKey, data.questions]
	);

	const getSummaryStats = useCallback((): SummaryStats => {
		const total = data.questions.length;
		let correct = 0;
		let incorrect = 0;
		let unanswered = 0;

		data.questions.forEach((question) => {
			const status = getAnswerStatus(question.uid, question.answer);
			if (status === true) {
				correct++;
			} else if (status === false) {
				incorrect++;
			} else {
				unanswered++;
			}
		});

		return {total, correct, incorrect, unanswered};
	}, [data.questions, getAnswerStatus]);

	const exportData = useCallback((): void => {
		const exportData: ExportData = {
			questions: data.questions,
			answerKey: data.answerKey,
			timestamp: new Date().toISOString(),
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], {
			type: "application/json",
		});

		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `answer_sheet_${new Date().toISOString().split("T")[0]}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, [data]);

	const importData = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const file = event.target.files?.[0];
			if (!file) return;

			setIsImporting(true);
			const reader = new FileReader();

			reader.onload = (e) => {
				try {
					const result = e.target?.result;
					if (typeof result !== "string") {
						throw new Error("Invalid file content");
					}

					const importedData: Partial<ExportData> = JSON.parse(result);

					if (
						!Array.isArray(importedData.questions) ||
						!Array.isArray(importedData.answerKey)
					) {
						throw new Error("Invalid data format");
					}

					replaceQuestions(importedData.questions);
					replaceKeys(importedData.answerKey);

					alert("Data imported successfully!");
				} catch (error) {
					console.error("Import error:", error);
					alert("Error importing data. Please check the file format.");
				} finally {
					setIsImporting(false);
				}
			};

			reader.onerror = () => {
				setIsImporting(false);
				alert("Error reading file.");
			};

			reader.readAsText(file);
			event.target.value = "";
		},
		[replaceQuestions, replaceKeys]
	);

	const clearAll = useCallback((): void => {
		if (window.confirm("Are you sure you want to clear all data?")) {
			replaceQuestions([]);
			replaceKeys([]);
		}
	}, [replaceQuestions, replaceKeys]);

	const removeQuestionAndKey = useCallback(
		(index: number): void => {
			removeQuestion(index);
			removeKey(index);
		},
		[removeQuestion, removeKey]
	);

	const stats = getSummaryStats();

	return (
		<div className="w-screen h-screen">
			<div className="max-w-4xl mx-auto p-6">
				<Card>
					<CardHeader className="relative">
						{loadingUpdateRemote && (
							<Loader2 className="animate-spin absolute top-0 right-4" />
						)}
						<CardTitle className="text-3xl font-bold mb-4">
							Answer Sheet Self-Revision
						</CardTitle>

						{/* Action Buttons */}
						<div className="flex flex-wrap gap-2">
							<Button
								onClick={() => addQuestions(10)}
								variant="default"
								size="sm"
							>
								<Plus className="w-4 h-4 mr-2" />
								Add 10 Questions
							</Button>

							<Button
								onClick={() => addQuestions(100)}
								variant="default"
								size="sm"
							>
								<Plus className="w-4 h-4 mr-2" />
								Add 100 Questions
							</Button>

							<Button
								onClick={() => {
									window.scroll({
										top: document.body.scrollHeight,
									});
								}}
								variant="default"
								size="sm"
							>
								View Stats
							</Button>

							<Button
								onClick={exportData}
								variant="outline"
								size="sm"
								disabled={stats.total === 0}
							>
								<Download className="w-4 h-4 mr-2" />
								Export
							</Button>

							<Button
								variant="outline"
								size="sm"
								disabled={isImporting}
								asChild
							>
								<label className="cursor-pointer">
									<Upload className="w-4 h-4 mr-2" />
									{isImporting ? "Importing..." : "Import"}
									<input
										type="file"
										accept=".json"
										onChange={importData}
										className="hidden"
										disabled={isImporting}
									/>
								</label>
							</Button>

							<Button
								onClick={clearAll}
								variant="destructive"
								size="sm"
								disabled={stats.total === 0}
							>
								<Trash2 className="w-4 h-4 mr-2" />
								Clear All
							</Button>
						</div>
					</CardHeader>

					<CardContent>
						<Tabs
							value={activeTab}
							onValueChange={(value) =>
								setActiveTab(value as "questions" | "key")
							}
						>
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="questions">
									Questions & Answers ({questionFields.length})
								</TabsTrigger>
								<TabsTrigger value="key">
									Answer Key ({keyFields.length})
								</TabsTrigger>
							</TabsList>

							{/* Questions Tab */}
							<TabsContent value="questions" className="space-y-4 mt-6">
								<div className="flex items-center justify-between">
									<h2 className="text-xl font-semibold">
										Questions & Your Answers
									</h2>
									<div className="flex gap-2">
										<Badge variant="outline">Total: {stats.total}</Badge>
										<Badge variant="default" className="bg-green-500">
											Correct: {stats.correct}
										</Badge>
										<Badge variant="destructive">
											Wrong: {stats.incorrect}
										</Badge>
									</div>
								</div>

								{questionFields.length === 0 ? (
									<Alert>
										<AlertDescription>
											No questions yet. Add some questions to get started.
										</AlertDescription>
									</Alert>
								) : (
									<div className="space-y-3">
										{questionFields.map((field, index) => {
											const answer =
												questionForm.watch(`questions.${index}.answer`) || "";
											const status = getAnswerStatus(field.uid, answer);

											return (
												<Card key={field.id}>
													<CardContent className="flex items-center gap-3 p-4">
														<Badge
															variant="outline"
															className="text-sm font-medium min-w-[3rem]"
														>
															Q{index + 1}
														</Badge>

														<div className="flex-1 relative">
															<Input
																{...questionForm.register(
																	`questions.${index}.answer`
																)}
																placeholder="Enter your answer..."
																className="pr-10"
															/>
															<div className="absolute right-3 top-1/2 transform -translate-y-1/2">
																{status === true && (
																	<Check className="text-green-500 w-5 h-5" />
																)}
																{status === false && (
																	<X className="text-red-500 w-5 h-5" />
																)}
															</div>
														</div>

														<Button
															onClick={() => removeQuestionAndKey(index)}
															variant="ghost"
															size="sm"
															className="text-red-500 hover:text-red-700"
														>
															<Trash2 className="w-4 h-4" />
														</Button>
													</CardContent>
												</Card>
											);
										})}
									</div>
								)}
							</TabsContent>

							{/* Answer Key Tab */}
							<TabsContent value="key" className="space-y-4 mt-6">
								<h2 className="text-xl font-semibold">Answer Key</h2>

								{keyFields.length === 0 ? (
									<Alert>
										<AlertDescription>
											No answer keys yet. Add some questions first.
										</AlertDescription>
									</Alert>
								) : (
									<div className="space-y-3">
										{keyFields.map((field, index) => (
											<Card key={field.id}>
												<CardContent className="flex items-center gap-3 p-4">
													<Badge
														variant="secondary"
														className="text-sm font-medium min-w-[3rem]"
													>
														A{index + 1}
													</Badge>

													<div className="flex-1">
														<Input
															{...keyForm.register(
																`answerKey.${index}.correctAnswer`
															)}
															placeholder="Enter correct answer..."
														/>
													</div>

													<Button
														onClick={() => removeQuestionAndKey(index)}
														variant="ghost"
														size="sm"
														className="text-red-500 hover:text-red-700"
													>
														<Trash2 className="w-4 h-4" />
													</Button>
												</CardContent>
											</Card>
										))}
									</div>
								)}
							</TabsContent>
						</Tabs>

						{/* Status Summary */}
						{stats.total > 0 && (
							<Card className="mt-6">
								<CardHeader>
									<CardTitle className="text-lg">
										Summary
										<Button
											onClick={() => {
												window.scrollTo({top: 0});
											}}
											variant="ghost"
											size="lg"
											className="float-right"
										>
											<ArrowUpCircle className="w-12 h-12" />
										</Button>
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
										<div className="text-center">
											<div className="text-2xl font-bold text-gray-700">
												{stats.total}
											</div>
											<div className="text-sm text-gray-500">
												Total Questions
											</div>
										</div>
										<div className="text-center">
											<div className="text-2xl font-bold text-green-600">
												{stats.correct}
											</div>
											<div className="text-sm text-gray-500">Correct</div>
										</div>
										<div className="text-center">
											<div className="text-2xl font-bold text-red-600">
												{stats.incorrect}
											</div>
											<div className="text-sm text-gray-500">Incorrect</div>
										</div>
										<div className="text-center">
											<div className="text-2xl font-bold text-gray-500">
												{stats.unanswered}
											</div>
											<div className="text-sm text-gray-500">Unanswered</div>
										</div>
									</div>
									{stats.total > 0 && (
										<div className="mt-4 text-center">
											<div className="text-lg font-semibold">
												Accuracy:{" "}
												{stats.total > 0
													? Math.round(
															(stats.correct /
																(stats.correct + stats.incorrect)) *
																100
													  ) || 0
													: 0}
												%
											</div>
										</div>
									)}
								</CardContent>
							</Card>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

export default AnswerSheetApp;
